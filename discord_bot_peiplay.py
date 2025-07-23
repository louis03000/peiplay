import os
import asyncio
import random
import discord
from discord.ext import commands
from discord import app_commands
from discord.ui import View, Button, Modal, TextInput
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
import threading
import requests
import json

# --- 環境設定 ---
load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
PEIPLAY_API_URL = os.getenv("PEIPLAY_API_URL", "http://localhost:3004")
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))

# --- Discord Bot 設定 ---
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.members = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents)
active_voice_channels = {}
evaluated_records = set()
pending_ratings = {}

ANIMALS = ["🦊 狐狸", "🐱 貓咪", "🐶 小狗", "🐻 熊熊", "🐼 貓熊", "🐯 老虎", "🦁 獅子", "🐸 青蛙", "🐵 猴子"]
TW_TZ = timezone(timedelta(hours=8))

# --- PeiPlay API 輔助函數 ---
def get_peiplay_user_by_discord(discord_id: str):
    """透過 Discord ID 查詢 PeiPlay 用戶"""
    try:
        # 這裡需要實作查詢邏輯，可能需要透過 email 或其他方式
        # 暫時回傳 None，需要根據實際情況調整
        return None
    except Exception as e:
        print(f"查詢 PeiPlay 用戶失敗: {e}")
        return None

def create_peiplay_booking(user1_id: str, user2_id: str, duration_minutes: int):
    """在 PeiPlay 中創建配對記錄"""
    try:
        # 這裡需要實作創建 booking 的邏輯
        # 可能需要先創建 Schedule，再創建 Booking
        booking_data = {
            "user1_id": user1_id,
            "user2_id": user2_id,
            "duration": duration_minutes,
            "type": "discord_pairing"
        }
        # 實際實作時需要呼叫 PeiPlay API
        return {"id": f"discord_{datetime.now().timestamp()}", "success": True}
    except Exception as e:
        print(f"創建 PeiPlay booking 失敗: {e}")
        return None

def create_peiplay_review(booking_id: str, reviewer_id: str, reviewee_id: str, rating: int, comment: str = None):
    """在 PeiPlay 中創建評價"""
    try:
        review_data = {
            "bookingId": booking_id,
            "reviewerId": reviewer_id,
            "revieweeId": reviewee_id,
            "rating": rating,
            "comment": comment
        }
        # 實際實作時需要呼叫 PeiPlay API
        return {"success": True}
    except Exception as e:
        print(f"創建 PeiPlay review 失敗: {e}")
        return None

# --- 本地配對記錄（暫時使用，之後可以完全整合到 PeiPlay） ---
class DiscordPairingRecord:
    def __init__(self, user1_id: str, user2_id: str, duration: int, animal_name: str):
        self.id = f"discord_{datetime.now().timestamp()}"
        self.user1_id = user1_id
        self.user2_id = user2_id
        self.duration = duration
        self.animal_name = animal_name
        self.extended_times = 0
        self.rating = None
        self.comment = None
        self.created_at = datetime.now()

# --- 評分 Modal ---
class RatingModal(Modal, title="匿名評分與留言"):
    rating = TextInput(label="給予評分（1～5 星）", required=True)
    comment = TextInput(label="留下你的留言（選填）", required=False)

    def __init__(self, record_id):
        super().__init__()
        self.record_id = record_id

    async def on_submit(self, interaction: discord.Interaction):
        try:
            rating = int(str(self.rating))
            comment = str(self.comment) if self.comment else None
            
            # 找到對應的記錄
            record = None
            for vc_id, data in active_voice_channels.items():
                if hasattr(data, 'record_id') and data['record_id'] == self.record_id:
                    record = data.get('record')
                    break
            
            if record:
                record.rating = rating
                record.comment = comment
                
                # 創建 PeiPlay review
                reviewer_id = str(interaction.user.id)
                reviewee_id = record.user2_id if reviewer_id == record.user1_id else record.user1_id
                
                create_peiplay_review(
                    booking_id=record.id,
                    reviewer_id=reviewer_id,
                    reviewee_id=reviewee_id,
                    rating=rating,
                    comment=comment
                )
                
                if self.record_id not in pending_ratings:
                    pending_ratings[self.record_id] = []
                pending_ratings[self.record_id].append({
                    'rating': rating,
                    'comment': comment,
                    'user1': reviewer_id,
                    'user2': reviewee_id
                })
                
                evaluated_records.add(self.record_id)
                await interaction.response.send_message("✅ 感謝你的匿名評價！", ephemeral=True)
            else:
                await interaction.response.send_message("❌ 找不到對應的配對記錄。", ephemeral=True)
                
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
        for user in [interaction.user] + mentioned:
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

        admin = bot.get_channel(ADMIN_CHANNEL_ID)
        if admin:
            try:
                u1 = await bot.fetch_user(int(record.user1_id))
                u2 = await bot.fetch_user(int(record.user2_id))
                header = f"📋 配對紀錄：{u1.mention} × {u2.mention} | {record.duration//60} 分鐘 | 延長 {record.extended_times} 次"

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

    mentioned = [m for m in interaction.guild.members if f"<@{m.id}>" in members]
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

        # 創建本地記錄
        record = DiscordPairingRecord(
            user1_id=str(interaction.user.id),
            user2_id=str(mentioned[0].id),
            duration=minutes * 60,
            animal_name=animal
        )

        # 嘗試創建 PeiPlay booking
        peiplay_booking = create_peiplay_booking(
            user1_id=str(interaction.user.id),
            user2_id=str(mentioned[0].id),
            duration_minutes=minutes
        )

        active_voice_channels[vc.id] = {
            'text_channel': text_channel,
            'remaining': minutes * 60,
            'extended': 0,
            'record_id': record.id,
            'record': record,
            'vc': vc
        }

        await countdown(vc.id, animal_channel_name, text_channel, vc, interaction, mentioned, record)

    bot.loop.create_task(countdown_wrapper())

# --- 其他 Slash 指令 ---
@bot.tree.command(name="mystats", description="查詢自己的配對統計", guild=discord.Object(id=GUILD_ID))
async def mystats(interaction: discord.Interaction):
    # 這裡可以整合 PeiPlay 的統計資料
    user_id = str(interaction.user.id)
    
    # 暫時使用本地記錄，之後可以從 PeiPlay API 取得
    records = [r for r in active_voice_channels.values() if hasattr(r, 'record') and 
               (r['record'].user1_id == user_id or r['record'].user2_id == user_id)]
    
    count = len(records)
    ratings = [r['record'].rating for r in records if r['record'].rating]
    comments = [r['record'].comment for r in records if r['record'].comment]
    avg_rating = round(sum(ratings)/len(ratings), 1) if ratings else "無"
    
    await interaction.response.send_message(
        f"📊 你的配對紀錄：\n- 配對次數：{count} 次\n- 平均評分：{avg_rating} ⭐\n- 收到留言：{len(comments)} 則", 
        ephemeral=True
    )

@bot.tree.command(name="stats", description="查詢他人配對統計 (限管理員)", guild=discord.Object(id=GUILD_ID))
@app_commands.describe(member="要查詢的使用者")
async def stats(interaction: discord.Interaction, member: discord.Member):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ 僅限管理員查詢。", ephemeral=True)
        return
    
    user_id = str(member.id)
    records = [r for r in active_voice_channels.values() if hasattr(r, 'record') and 
               (r['record'].user1_id == user_id or r['record'].user2_id == user_id)]
    
    count = len(records)
    ratings = [r['record'].rating for r in records if r['record'].rating]
    comments = [r['record'].comment for r in records if r['record'].comment]
    avg_rating = round(sum(ratings)/len(ratings), 1) if ratings else "無"
    
    await interaction.response.send_message(
        f"📊 <@{member.id}> 的配對紀錄：\n- 配對次數：{count} 次\n- 平均評分：{avg_rating} ⭐\n- 收到留言：{len(comments)} 則", 
        ephemeral=True
    )

@bot.tree.command(name="report", description="舉報不當行為", guild=discord.Object(id=GUILD_ID))
@app_commands.describe(member="被舉報的使用者", reason="舉報原因")
async def report(interaction: discord.Interaction, member: discord.Member, reason: str):
    admin = bot.get_channel(ADMIN_CHANNEL_ID)
    await interaction.response.send_message("✅ 舉報已提交，感謝你的協助。", ephemeral=True)
    if admin:
        await admin.send(f"🚨 舉報通知：<@{interaction.user.id}> 舉報 <@{member.id}>\n📄 理由：{reason}")

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