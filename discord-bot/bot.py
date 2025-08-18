import os 
import asyncio
import random
import discord
from discord.ext import commands, tasks
from discord import app_commands
from discord.ui import View, Button, Modal, TextInput
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
import threading

# --- 環境與資料庫設定 ---
load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
POSTGRES_CONN = os.getenv("POSTGRES_CONN")
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "30"))  # 檢查間隔（秒）

Base = declarative_base()
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)
session = Session()

# --- 資料庫模型（對應 Prisma schema）---
class User(Base):
    __tablename__ = 'User'
    id = Column(String, primary_key=True)
    email = Column(String)
    name = Column(String)
    discord = Column(String)  # 已經在註冊時設定
    role = Column(String)
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)

class Partner(Base):
    __tablename__ = 'Partner'
    id = Column(String, primary_key=True)
    name = Column(String)
    userId = Column(String, ForeignKey('User.id'))
    user = relationship("User")
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)

class Customer(Base):
    __tablename__ = 'Customer'
    id = Column(String, primary_key=True)
    name = Column(String)
    userId = Column(String, ForeignKey('User.id'))
    user = relationship("User")
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)

class Schedule(Base):
    __tablename__ = 'Schedule'
    id = Column(String, primary_key=True)
    partnerId = Column(String, ForeignKey('Partner.id'))
    date = Column(DateTime)
    startTime = Column(DateTime)
    endTime = Column(DateTime)
    isAvailable = Column(Boolean, default=True)
    partner = relationship("Partner")
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)

class Booking(Base):
    __tablename__ = 'Booking'
    id = Column(String, primary_key=True)
    customerId = Column(String, ForeignKey('Customer.id'))
    scheduleId = Column(String, ForeignKey('Schedule.id'))
    status = Column(String)  # BookingStatus
    orderNumber = Column(String)
    paymentInfo = Column(String)  # JSON string
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow)
    finalAmount = Column(Float)
    customer = relationship("Customer")
    schedule = relationship("Schedule")

class PairingRecord(Base):
    __tablename__ = 'pairing_records'
    id = Column(Integer, primary_key=True)
    user1_id = Column(String)
    user2_id = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    extended_times = Column(Integer, default=0)
    duration = Column(Integer, default=0)
    rating = Column(Integer, nullable=True)
    comment = Column(String, nullable=True)
    animal_name = Column(String)
    booking_id = Column(String, nullable=True)  # 關聯到預約ID

class BlockRecord(Base):
    __tablename__ = 'block_records'
    id = Column(Integer, primary_key=True)
    blocker_id = Column(String)
    blocked_id = Column(String)

Base.metadata.create_all(engine)

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.members = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents)
active_voice_channels = {}
evaluated_records = set()
pending_ratings = {}
processed_bookings = set()  # 記錄已處理的預約

ANIMALS = ["🦊 狐狸", "🐱 貓咪", "🐶 小狗", "🐻 熊熊", "🐼 貓熊", "🐯 老虎", "🦁 獅子", "🐸 青蛙", "🐵 猴子"]
TW_TZ = timezone(timedelta(hours=8))

# --- 成員搜尋函數 ---
def find_member_by_discord_name(guild, discord_name):
    """根據 Discord 名稱搜尋成員"""
    if not discord_name:
        return None
    
    discord_name_lower = discord_name.lower()
    for member in guild.members:
        if member.name.lower() == discord_name_lower or member.display_name.lower() == discord_name_lower:
            return member
    return None

# --- 自動檢查預約任務 ---
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_bookings():
    """定期檢查已付款的預約並創建語音頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        # 查詢已確認且即將開始的預約
        now = datetime.now(timezone.utc)
        window_start = now
        window_end = now + timedelta(minutes=5)  # 5分鐘內即將開始
        
        with Session() as s:
            bookings = s.query(Booking).join(Schedule).filter(
                Booking.status.in_(['CONFIRMED', 'COMPLETED']),
                Booking.id.notin_(processed_bookings),
                Schedule.startTime >= window_start,
                Schedule.startTime <= window_end
            ).all()
            
            for booking in bookings:
                try:
                    # 獲取顧客和夥伴的 Discord 名稱
                    customer_discord = booking.customer.user.discord if booking.customer and booking.customer.user else None
                    partner_discord = booking.schedule.partner.user.discord if booking.schedule and booking.schedule.partner and booking.schedule.partner.user else None
                    
                    if not customer_discord or not partner_discord:
                        print(f"❌ 預約 {booking.id} 缺少 Discord 名稱: 顧客={customer_discord}, 夥伴={partner_discord}")
                        continue
                    
                    # 查找 Discord 成員
                    customer_member = find_member_by_discord_name(guild, customer_discord)
                    partner_member = find_member_by_discord_name(guild, partner_discord)
                    
                    if not customer_member or not partner_member:
                        print(f"❌ 找不到 Discord 成員: 顧客={customer_discord}, 夥伴={partner_discord}")
                        continue
                    
                    # 計算頻道持續時間
                    duration_minutes = int((booking.schedule.endTime - booking.schedule.startTime).total_seconds() / 60)
                    
                    # 創建語音頻道
                    animal = random.choice(ANIMALS)
                    channel_name = f"{animal}頻道-{booking.orderNumber or booking.id[:8]}"
                    
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(view_channel=False),
                        customer_member: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
                        partner_member: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
                    }
                    
                    category = discord.utils.get(guild.categories, name="語音頻道")
                    if not category:
                        print("❌ 找不到「語音頻道」分類")
                        continue
                    
                    vc = await guild.create_voice_channel(
                        name=channel_name, 
                        overwrites=overwrites, 
                        user_limit=2, 
                        category=category
                    )
                    
                    text_channel = await guild.create_text_channel(
                        name="🔒匿名文字區", 
                        overwrites=overwrites, 
                        category=category
                    )
                    
                    # 創建配對記錄
                    record = PairingRecord(
                        user1_id=str(customer_member.id),
                        user2_id=str(partner_member.id),
                        duration=duration_minutes * 60,
                        animal_name=animal,
                        booking_id=booking.id
                    )
                    s.add(record)
                    s.commit()
                    
                    # 初始化頻道狀態
                    active_voice_channels[vc.id] = {
                        'text_channel': text_channel,
                        'remaining': duration_minutes * 60,
                        'extended': 0,
                        'record_id': record.id,
                        'vc': vc,
                        'booking_id': booking.id
                    }
                    
                    # 標記為已處理
                    processed_bookings.add(booking.id)
                    
                    # 通知管理員
                    admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
                    if admin_channel:
                        await admin_channel.send(
                            f"🎉 自動創建語音頻道：\n"
                            f"📋 預約ID: {booking.id}\n"
                            f"👤 顧客: {customer_member.mention} ({customer_discord})\n"
                            f"👥 夥伴: {partner_member.mention} ({partner_discord})\n"
                            f"⏰ 時間: {duration_minutes} 分鐘\n"
                            f"🎮 頻道: {vc.mention}"
                        )
                    
                    # 啟動倒數
                    bot.loop.create_task(
                        countdown(vc.id, channel_name, text_channel, vc, None, [customer_member, partner_member], record)
                    )
                    
                    print(f"✅ 自動創建頻道成功: {channel_name} for booking {booking.id}")
                    
                except Exception as e:
                    print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
                    continue
                    
    except Exception as e:
        print(f"❌ 檢查預約時發生錯誤: {e}")

# --- 評分 Modal ---
class RatingModal(Modal, title="匿名評分與留言"):
    rating = TextInput(label="給予評分（1～5 星）", required=True)
    comment = TextInput(label="留下你的留言（選填）", required=False)

    def __init__(self, record_id):
        super().__init__()
        self.record_id = record_id

    async def on_submit(self, interaction: discord.Interaction):
        try:
            record = session.get(PairingRecord, self.record_id)
            record.rating = int(str(self.rating))
            record.comment = str(self.comment)
            session.commit()
            await interaction.response.send_message("✅ 感謝你的匿名評價！", ephemeral=True)

            if self.record_id not in pending_ratings:
                pending_ratings[self.record_id] = []
            pending_ratings[self.record_id].append({
                'rating': record.rating,
                'comment': record.comment,
                'user1': str(interaction.user.id),
                'user2': str(record.user2_id if str(interaction.user.id) == record.user1_id else record.user1_id)
            })

            evaluated_records.add(self.record_id)
        except Exception as e:
            await interaction.response.send_message(f"❌ 提交失敗：{e}", ephemeral=True)

# --- 延長按鈕 ---
class ExtendView(View):
    def __init__(self, vc_id):
        super().__init__(timeout=None)
        self.vc_id = vc_id

    @discord.ui.button(label="🔁 延長 10 分鐘", style=discord.ButtonStyle.primary)
    async def extend_button(self, interaction: discord.Interaction, button: Button):
        if self.vc_id not in active_voice_channels:
            await interaction.response.send_message("❗ 頻道資訊不存在或已刪除。", ephemeral=True)
            return
        active_voice_channels[self.vc_id]['remaining'] += 600
        active_voice_channels[self.vc_id]['extended'] += 1
        await interaction.response.send_message("⏳ 已延長 10 分鐘。", ephemeral=True)

# --- Bot 啟動 ---
@bot.event
async def on_ready():
    print(f"✅ Bot 上線：{bot.user}")
    try:
        guild = discord.Object(id=GUILD_ID)
        synced = await bot.tree.sync(guild=guild)
        print(f"✅ Slash 指令已同步：{len(synced)} 個指令")
        
        # 啟動自動檢查任務
        check_bookings.start()
        print(f"✅ 自動檢查預約任務已啟動，檢查間隔：{CHECK_INTERVAL} 秒")
    except Exception as e:
        print(f"❌ 指令同步失敗: {e}")

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return
    if message.content == "!ping":
        await message.channel.send("Pong!")
    await bot.process_commands(message)

# --- 倒數邏輯 ---
async def countdown(vc_id, animal_channel_name, text_channel, vc, interaction, mentioned, record):
    try:
        # 移動用戶到語音頻道（如果是自動創建的，mentioned 已經包含用戶）
        if mentioned:
            for user in mentioned:
                if user.voice and user.voice.channel:
                    await user.move_to(vc)

        view = ExtendView(vc.id)
        await text_channel.send(f"🎉 語音頻道 {animal_channel_name} 已開啟！\n⏳ 可延長10分鐘 ( 為了您有更好的遊戲體驗，請到最後需要時再點選 ) 。", view=view)

        while active_voice_channels[vc_id]['remaining'] > 0:
            remaining = active_voice_channels[vc_id]['remaining']
            if remaining == 60:
                await text_channel.send("⏰ 剩餘 1 分鐘。")
            await asyncio.sleep(1)
            active_voice_channels[vc_id]['remaining'] -= 1

        await vc.delete()
        await text_channel.send("📝 請點擊以下按鈕進行匿名評分。")

        class SubmitButton(View):
            def __init__(self):
                super().__init__(timeout=300)
                self.clicked = False

            @discord.ui.button(label="匿名評分", style=discord.ButtonStyle.success)
            async def submit(self, interaction: discord.Interaction, button: Button):
                if self.clicked:
                    await interaction.response.send_message("❗ 已提交過評價。", ephemeral=True)
                    return
                self.clicked = True
                await interaction.response.send_modal(RatingModal(record.id))

        await text_channel.send(view=SubmitButton())
        await asyncio.sleep(300)
        await text_channel.delete()

        record.extended_times = active_voice_channels[vc_id]['extended']
        record.duration += record.extended_times * 600
        session.commit()

        admin = bot.get_channel(ADMIN_CHANNEL_ID)
        if admin:
            try:
                u1 = await bot.fetch_user(int(record.user1_id))
                u2 = await bot.fetch_user(int(record.user2_id))
                header = f"📋 配對紀錄：{u1.mention} × {u2.mention} | {record.duration//60} 分鐘 | 延長 {record.extended_times} 次"
                
                if record.booking_id:
                    header += f" | 預約ID: {record.booking_id}"

                if record.id in pending_ratings:
                    feedback = "\n⭐ 評價回饋："
                    for r in pending_ratings[record.id]:
                        from_user = await bot.fetch_user(int(r['user1']))
                        to_user = await bot.fetch_user(int(r['user2']))
                        feedback += f"\n- 「{from_user.mention} → {to_user.mention}」：{r['rating']} ⭐"
                        if r['comment']:
                            feedback += f"\n  💬 {r['comment']}"
                    del pending_ratings[record.id]
                    await admin.send(f"{header}{feedback}")
                else:
                    await admin.send(f"{header}\n⭐ 沒有收到任何評價。")
            except Exception as e:
                print(f"推送管理區評價失敗：{e}")

        active_voice_channels.pop(vc_id, None)
    except Exception as e:
        print(f"❌ 倒數錯誤: {e}")

# --- 指令：/createvc ---
@bot.tree.command(name="createvc", description="建立匿名語音頻道（指定開始時間）", guild=discord.Object(id=GUILD_ID))
@app_commands.describe(members="標註的成員們", minutes="存在時間（分鐘）", start_time="幾點幾分後啟動 (格式: HH:MM, 24hr)", limit="人數上限")
async def createvc(interaction: discord.Interaction, members: str, minutes: int, start_time: str, limit: int = 2):
    await interaction.response.defer()
    try:
        hour, minute = map(int, start_time.split(":"))
        now = datetime.now(TW_TZ)
        start_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if start_dt < now:
            start_dt += timedelta(days=1)
        start_dt_utc = start_dt.astimezone(timezone.utc)
    except:
        await interaction.followup.send("❗ 時間格式錯誤，請使用 HH:MM 24 小時制。")
        return

    with Session() as s:
        blocked_ids = [b.blocked_id for b in s.query(BlockRecord).filter(BlockRecord.blocker_id == str(interaction.user.id)).all()]
    mentioned = [m for m in interaction.guild.members if f"<@{m.id}>" in members and str(m.id) not in blocked_ids]
    if not mentioned:
        await interaction.followup.send("❗請標註至少一位成員。")
        return

    animal = random.choice(ANIMALS)
    animal_channel_name = f"{animal}頻道"
    await interaction.followup.send(f"✅ 已排程配對頻道：{animal_channel_name} 將於 <t:{int(start_dt_utc.timestamp())}:t> 開啟")

    async def countdown_wrapper():
        await asyncio.sleep((start_dt_utc - datetime.now(timezone.utc)).total_seconds())

        overwrites = {
            interaction.guild.default_role: discord.PermissionOverwrite(view_channel=False),
            interaction.user: discord.PermissionOverwrite(view_channel=True, connect=True),
        }
        for m in mentioned:
            overwrites[m] = discord.PermissionOverwrite(view_channel=True, connect=True)

        category = discord.utils.get(interaction.guild.categories, name="語音頻道")
        vc = await interaction.guild.create_voice_channel(name=animal_channel_name, overwrites=overwrites, user_limit=limit, category=category)
        text_channel = await interaction.guild.create_text_channel(name="🔒匿名文字區", overwrites=overwrites, category=category)

        record = PairingRecord(
            user1_id=str(interaction.user.id),
            user2_id=str(mentioned[0].id),
            duration=minutes * 60,
            animal_name=animal
        )
        session.add(record)
        session.commit()

        active_voice_channels[vc.id] = {
            'text_channel': text_channel,
            'remaining': minutes * 60,
            'extended': 0,
            'record_id': record.id,
            'vc': vc
        }

        await countdown(vc.id, animal_channel_name, text_channel, vc, interaction, mentioned, record)

    bot.loop.create_task(countdown_wrapper())

# --- 其他 Slash 指令 ---
@bot.tree.command(name="viewblocklist", description="查看你封鎖的使用者", guild=discord.Object(id=GUILD_ID))
async def view_blocklist(interaction: discord.Interaction):
    with Session() as s:
        blocks = s.query(BlockRecord).filter(BlockRecord.blocker_id == str(interaction.user.id)).all()
        if not blocks:
            await interaction.response.send_message("📭 你尚未封鎖任何人。", ephemeral=True)
            return
        blocked_mentions = [f"<@{b.blocked_id}>" for b in blocks]
        await interaction.response.send_message(f"🔒 你封鎖的使用者：\n" + "\n".join(blocked_mentions), ephemeral=True)

@bot.tree.command(name="unblock", description="解除你封鎖的某人", guild=discord.Object(id=GUILD_ID))
@app_commands.describe(member="要解除封鎖的使用者")
async def unblock(interaction: discord.Interaction, member: discord.Member):
    with Session() as s:
        block = s.query(BlockRecord).filter_by(blocker_id=str(interaction.user.id), blocked_id=str(member.id)).first()
        if block:
            s.delete(block)
            s.commit()
            await interaction.response.send_message(f"✅ 已解除對 <@{member.id}> 的封鎖。", ephemeral=True)
        else:
            await interaction.response.send_message("❗ 你沒有封鎖這位使用者。", ephemeral=True)

@bot.tree.command(name="report", description="舉報不當行為", guild=discord.Object(id=GUILD_ID))
@app_commands.describe(member="被舉報的使用者", reason="舉報原因")
async def report(interaction: discord.Interaction, member: discord.Member, reason: str):
    admin = bot.get_channel(ADMIN_CHANNEL_ID)
    await interaction.response.send_message("✅ 舉報已提交，感謝你的協助。", ephemeral=True)
    if admin:
        await admin.send(f"🚨 舉報通知：<@{interaction.user.id}> 舉報 <@{member.id}>\n📄 理由：{reason}")

@bot.tree.command(name="mystats", description="查詢自己的配對統計", guild=discord.Object(id=GUILD_ID))
async def mystats(interaction: discord.Interaction):
    records = session.query(PairingRecord).filter((PairingRecord.user1_id==str(interaction.user.id)) | (PairingRecord.user2_id==str(interaction.user.id))).all()
    count = len(records)
    ratings = [r.rating for r in records if r.rating]
    comments = [r.comment for r in records if r.comment]
    avg_rating = round(sum(ratings)/len(ratings), 1) if ratings else "無"
    await interaction.response.send_message(f"📊 你的配對紀錄：\n- 配對次數：{count} 次\n- 平均評分：{avg_rating} ⭐\n- 收到留言：{len(comments)} 則", ephemeral=True)

@bot.tree.command(name="stats", description="查詢他人配對統計 (限管理員)", guild=discord.Object(id=GUILD_ID))
@app_commands.describe(member="要查詢的使用者")
async def stats(interaction: discord.Interaction, member: discord.Member):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ 僅限管理員查詢。", ephemeral=True)
        return
    records = session.query(PairingRecord).filter((PairingRecord.user1_id==str(member.id)) | (PairingRecord.user2_id==str(member.id))).all()
    count = len(records)
    ratings = [r.rating for r in records if r.rating]
    comments = [r.comment for r in records if r.comment]
    avg_rating = round(sum(ratings)/len(ratings), 1) if ratings else "無"
    await interaction.response.send_message(f"📊 <@{member.id}> 的配對紀錄：\n- 配對次數：{count} 次\n- 平均評分：{avg_rating} ⭐\n- 收到留言：{len(comments)} 則", ephemeral=True)

# --- Flask API ---
app = Flask(__name__)

@app.route("/move_user", methods=["POST"])
def move_user():
    data = request.get_json()
    discord_id = int(data.get("discord_id"))
    vc_id = int(data.get("vc_id"))

    async def mover():
        guild = bot.get_guild(GUILD_ID)
        member = guild.get_member(discord_id)
        vc = guild.get_channel(vc_id)
        if member and vc:
            await member.move_to(vc)

    bot.loop.create_task(mover())
    return jsonify({"status": "ok"})

def run_flask():
    app.run(host="0.0.0.0", port=5000)

threading.Thread(target=run_flask, daemon=True).start()
bot.run(TOKEN) 