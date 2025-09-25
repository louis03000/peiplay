import os 
import asyncio
import random
import discord
from discord.ext import commands, tasks
from discord import app_commands
from discord.ui import View, Button, Modal, TextInput
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, Float, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, joinedload
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
import threading

# --- 環境與資料庫設定 ---
load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
POSTGRES_CONN = os.getenv("POSTGRES_CONN")
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "1419601068110778450"))

# 檢查必要的環境變數
if not TOKEN:
    print("❌ 錯誤：未設定 DISCORD_BOT_TOKEN 環境變數")
    print("請在 .env 檔案中設定您的 Discord bot token")
    exit(1)

if not POSTGRES_CONN:
    print("❌ 錯誤：未設定 POSTGRES_CONN 環境變數")
    print("請在 .env 檔案中設定資料庫連線字串")
    exit(1)
CHANNEL_CREATION_CHANNEL_ID = int(os.getenv("CHANNEL_CREATION_CHANNEL_ID", "1410318589348810923"))  # 創建頻道通知頻道
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
    orderNumber = Column(String, nullable=True)  # 可選欄位
    paymentInfo = Column(String, nullable=True)  # JSON string
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow)
    finalAmount = Column(Float, nullable=True)
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

# 不自動創建表，因為我們使用的是現有的 Prisma 資料庫
# Base.metadata.create_all(engine)

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
processed_text_channels = set()  # 記錄已創建文字頻道的預約

# 可愛的動物和物品列表
CUTE_ITEMS = ["🦊 狐狸", "🐱 貓咪", "🐶 小狗", "🐻 熊熊", "🐼 貓熊", "🐯 老虎", "🦁 獅子", "🐸 青蛙", "🐵 猴子", "🐰 兔子", "🦄 獨角獸", "🐙 章魚", "🦋 蝴蝶", "🌸 櫻花", "⭐ 星星", "🌈 彩虹", "🍀 幸運草", "🎀 蝴蝶結", "🍭 棒棒糖", "🎈 氣球"]
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

# --- 創建預約文字頻道函數 ---
async def create_booking_text_channel(booking_id, customer_discord, partner_discord, start_time, end_time):
    """為預約創建文字頻道"""
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return None
        
        # 查找 Discord 成員
        customer_member = find_member_by_discord_name(guild, customer_discord)
        partner_member = find_member_by_discord_name(guild, partner_discord)
        
        if not customer_member or not partner_member:
            print(f"❌ 找不到 Discord 成員: 顧客={customer_discord}, 夥伴={partner_discord}")
            return None
        
        # 計算頻道持續時間
        duration_minutes = int((end_time - start_time).total_seconds() / 60)
        
        # 創建頻道名稱 - 使用日期和時間
        # 確保時間有時區資訊，並轉換為台灣時間
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        # 轉換為台灣時間
        tw_start_time = start_time.astimezone(TW_TZ)
        tw_end_time = end_time.astimezone(TW_TZ)
        
        # 格式化日期和時間
        date_str = tw_start_time.strftime("%m/%d")
        start_time_str = tw_start_time.strftime("%H:%M")
        end_time_str = tw_end_time.strftime("%H:%M")
        
        # 創建統一的頻道名稱 - 加上隨機可愛物品
        cute_item = random.choice(CUTE_ITEMS)
        channel_name = f"📅{date_str} {start_time_str}-{end_time_str} {cute_item}"
        
        # 設定權限
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            customer_member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
            partner_member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
        }
        
        # 找到分類
        category = discord.utils.get(guild.categories, name="Text Channels")
        if not category:
            category = discord.utils.get(guild.categories, name="文字頻道")
        if not category:
            category = discord.utils.get(guild.categories, name="文字")
        if not category:
            if guild.categories:
                category = guild.categories[0]
            else:
                print("❌ 找不到任何分類")
                return None
        
        # 創建文字頻道
        text_channel = await guild.create_text_channel(
            name=channel_name,
            overwrites=overwrites,
            category=category
        )
        
        # 發送歡迎訊息 - 修正時區顯示
        # 確保時間有時區資訊，並轉換為台灣時間
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        # 轉換為台灣時間
        tw_start_time = start_time.astimezone(TW_TZ)
        tw_end_time = end_time.astimezone(TW_TZ)
        
        start_time_str = tw_start_time.strftime("%Y/%m/%d %H:%M")
        end_time_str = tw_end_time.strftime("%H:%M")
        
        embed = discord.Embed(
            title=f"🎮 預約頻道",
            description=f"歡迎來到預約頻道！\n\n"
                       f"📅 **預約時間**: {start_time_str} - {end_time_str}\n"
                       f"⏰ **時長**: {duration_minutes} 分鐘\n"
                       f"👤 **顧客**: {customer_member.mention}\n"
                       f"👥 **夥伴**: {partner_member.mention}\n\n"
                       f"💬 你們可以在這裡提前溝通\n"
                       f"🎤 語音頻道將在預約開始前 5 分鐘自動創建",
            color=0x00ff00
        )
        
        await text_channel.send(embed=embed)
        
        # 發送預約通知到指定頻道
        notification_channel = bot.get_channel(1419585779432423546)
        if notification_channel:
            notification_embed = discord.Embed(
                title="🎉 新預約通知",
                description=f"新的預約已創建！",
                color=0x00ff00
            )
            notification_embed.add_field(
                name="📅 預約時間",
                value=f"{start_time_str} - {end_time_str}",
                inline=True
            )
            notification_embed.add_field(
                name="👤 參與者",
                value=f"{customer_member.mention} × {partner_member.mention}",
                inline=True
            )
            notification_embed.add_field(
                name="💬 溝通頻道",
                value=f"{text_channel.mention}",
                inline=True
            )
            notification_embed.add_field(
                name="⏰ 時長",
                value=f"{duration_minutes} 分鐘",
                inline=True
            )
            notification_embed.add_field(
                name="🎤 語音頻道",
                value="將在預約開始前 5 分鐘自動創建",
                inline=True
            )
            notification_embed.set_footer(text=f"預約ID: {booking_id}")
            
            await notification_channel.send(embed=notification_embed)
            print(f"✅ 已發送預約通知到指定頻道 (ID: 1419585779432423546)")
        
        # 保存頻道 ID 到資料庫
        try:
            with Session() as s:
                # 先檢查欄位是否存在
                check_column = s.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'Booking' 
                    AND column_name = 'discordTextChannelId'
                """)).fetchone()
                
                if check_column:
                    # 更新預約記錄，保存 Discord 頻道 ID
                    result = s.execute(
                        text("UPDATE \"Booking\" SET \"discordTextChannelId\" = :channel_id WHERE id = :booking_id"),
                        {"channel_id": str(text_channel.id), "booking_id": booking_id}
                    )
                    s.commit()
                    print(f"✅ 已保存文字頻道 ID {text_channel.id} 到預約 {booking_id}")
                else:
                    print(f"⚠️ Discord 欄位尚未創建，跳過保存頻道 ID")
        except Exception as db_error:
            print(f"❌ 保存頻道 ID 到資料庫失敗: {db_error}")
            # 即使保存失敗，頻道仍然可以使用
        
        # 通知創建頻道頻道
        channel_creation_channel = bot.get_channel(CHANNEL_CREATION_CHANNEL_ID)
        if channel_creation_channel:
            await channel_creation_channel.send(
                f"📝 預約文字頻道已創建：\n"
                f"📋 預約ID: {booking_id}\n"
                f"👤 顧客: {customer_member.mention} ({customer_discord})\n"
                f"👥 夥伴: {partner_member.mention} ({partner_discord})\n"
                f"⏰ 時間: {start_time_str} - {end_time_str}\n"
                f"💬 頻道: {text_channel.mention}"
            )
        
        print(f"✅ 預約文字頻道創建成功: {channel_name} for booking {booking_id}")
        return text_channel
        
    except Exception as e:
        print(f"❌ 創建預約文字頻道時發生錯誤: {e}")
        return None

# --- 創建預約語音頻道函數 ---
async def create_booking_voice_channel(booking_id, customer_discord, partner_discord, start_time, end_time, is_instant_booking=None, discord_delay_minutes=None):
    """為預約創建語音頻道"""
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return None
        
        # 查找 Discord 成員
        customer_member = find_member_by_discord_name(guild, customer_discord)
        partner_member = find_member_by_discord_name(guild, partner_discord)
        
        if not customer_member or not partner_member:
            print(f"❌ 找不到 Discord 成員: 顧客={customer_discord}, 夥伴={partner_discord}")
            return None
        
        # 計算頻道持續時間
        duration_minutes = int((end_time - start_time).total_seconds() / 60)
        
        # 創建頻道名稱 - 使用日期和時間
        # 確保時間有時區資訊，並轉換為台灣時間
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        # 轉換為台灣時間
        tw_start_time = start_time.astimezone(TW_TZ)
        tw_end_time = end_time.astimezone(TW_TZ)
        
        # 格式化日期和時間
        date_str = tw_start_time.strftime("%m/%d")
        start_time_str = tw_start_time.strftime("%H:%M")
        end_time_str = tw_end_time.strftime("%H:%M")
        
        # 創建統一的頻道名稱（與文字頻道相同）
        cute_item = random.choice(CUTE_ITEMS)
        if is_instant_booking == 'true':
            channel_name = f"⚡即時{date_str} {start_time_str}-{end_time_str} {cute_item}"
        else:
            channel_name = f"📅{date_str} {start_time_str}-{end_time_str} {cute_item}"
        
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            customer_member: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
            partner_member: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
        }
        
        category = discord.utils.get(guild.categories, name="Voice Channels")
        if not category:
            category = discord.utils.get(guild.categories, name="語音頻道")
        if not category:
            category = discord.utils.get(guild.categories, name="語音")
        if not category:
            # 嘗試使用第一個可用的分類
            if guild.categories:
                category = guild.categories[0]
                print(f"⚠️ 自動檢查使用現有分類: {category.name}")
            else:
                print("❌ 找不到任何分類，跳過此預約")
                return None
        
        vc = await guild.create_voice_channel(
            name=channel_name, 
            overwrites=overwrites, 
            user_limit=2, 
            category=category
        )
        
        # 不創建文字頻道，因為 check_new_bookings 已經創建了
        # text_channel = await guild.create_text_channel(
        #     name="🔒匿名文字區", 
        #     overwrites=overwrites, 
        #     category=category
        # )
        
        # 創建配對記錄
        user1_id = str(customer_member.id)
        user2_id = str(partner_member.id)
        
        # 添加調試信息
        print(f"🔍 自動創建配對記錄: {user1_id} × {user2_id}")
        
        with Session() as s:
            try:
                record = PairingRecord(
                    user1_id=user1_id,
                    user2_id=user2_id,
                    duration=duration_minutes * 60,
                    animal_name="預約頻道",
                    booking_id=booking_id
                )
                s.add(record)
                s.commit()
                record_id = record.id
                print(f"✅ 配對記錄創建成功，ID: {record_id}")
            except Exception as e:
                print(f"❌ 創建配對記錄失敗: {e}")
                record_id = None
        
        # 初始化頻道狀態
        active_voice_channels[vc.id] = {
            'text_channel': None,  # 文字頻道由 check_new_bookings 創建
            'remaining': duration_minutes * 60,
            'extended': 0,
            'record_id': record_id,
            'vc': vc,
            'booking_id': booking_id
        }
        
        if is_instant_booking == 'true':
            print(f"⚡ 即時預約語音頻道已創建: {channel_name} (預約 {booking_id})")
            print(f"⏰ Discord 頻道將在 {discord_delay_minutes} 分鐘後自動開啟")
            
            # 通知創建頻道頻道
            channel_creation_channel = bot.get_channel(CHANNEL_CREATION_CHANNEL_ID)
            if channel_creation_channel:
                await channel_creation_channel.send(
                    f"⚡ 即時預約語音頻道已創建：\n"
                    f"📋 預約ID: {booking_id}\n"
                    f"👤 顧客: {customer_member.mention} ({customer_discord})\n"
                    f"👥 夥伴: {partner_member.mention} ({partner_discord})\n"
                    f"⏰ 開始時間: {tw_start_time.strftime('%Y/%m/%d %H:%M')}\n"
                    f"⏱️ 時長: {duration_minutes} 分鐘\n"
                    f"🎮 頻道: {vc.mention}\n"
                    f"⏳ 將在 {discord_delay_minutes} 分鐘後自動開啟"
                )
            
            # 延遲開啟語音頻道
            async def delayed_open_voice():
                await asyncio.sleep(int(discord_delay_minutes or 3) * 60)  # 等待指定分鐘數
                try:
                    # 檢查預約狀態是否仍然是 PARTNER_ACCEPTED
                    with Session() as check_s:
                        current_booking = check_s.execute(
                            text("SELECT status FROM \"Booking\" WHERE id = :booking_id"),
                            {"booking_id": booking_id}
                        ).fetchone()
                        
                        if current_booking and current_booking.status == 'PARTNER_ACCEPTED':
                            # 開啟語音頻道
                            await vc.set_permissions(guild.default_role, view_channel=True)
                            # 文字頻道由 check_new_bookings 創建，這裡不需要處理
                            
                            # 發送開啟通知
                            embed = discord.Embed(
                                title="🎮 即時預約頻道已開啟！",
                                description=f"歡迎 {customer_member.mention} 和 {partner_member.mention} 來到 {channel_name}！",
                                color=0x00ff00,
                                timestamp=datetime.now(timezone.utc)
                            )
                            embed.add_field(name="⏰ 預約時長", value=f"{duration_minutes} 分鐘", inline=True)
                            embed.add_field(name="💰 費用", value=f"${duration_minutes * 2 * 150}", inline=True)  # 假設每半小時150元
                            
                            # 文字頻道由 check_new_bookings 創建，這裡不需要發送通知
                            print(f"✅ 即時預約語音頻道已開啟: {channel_name}")
                        else:
                            print(f"⚠️ 預約 {booking_id} 狀態已改變，取消延遲開啟")
                except Exception as e:
                    print(f"❌ 延遲開啟語音頻道失敗: {e}")
            
            # 啟動延遲開啟任務
            bot.loop.create_task(delayed_open_voice())
            
        else:
            # 通知創建頻道頻道
            channel_creation_channel = bot.get_channel(CHANNEL_CREATION_CHANNEL_ID)
            if channel_creation_channel:
                await channel_creation_channel.send(
                    f"🎉 自動創建語音頻道：\n"
                    f"📋 預約ID: {booking_id}\n"
                    f"👤 顧客: {customer_member.mention} ({customer_discord})\n"
                    f"👥 夥伴: {partner_member.mention} ({partner_discord})\n"
                    f"⏰ 開始時間: {tw_start_time.strftime('%Y/%m/%d %H:%M')}\n"
                    f"⏱️ 時長: {duration_minutes} 分鐘\n"
                    f"🎮 頻道: {vc.mention}"
                )
            
            # 啟動倒數
            if record_id:
                # 文字頻道由 check_new_bookings 創建，這裡先不啟動倒數
                # bot.loop.create_task(
                #     countdown(vc.id, channel_name, text_channel, vc, None, [customer_member, partner_member], record_id)
                # )
                pass
            
            print(f"✅ 自動創建頻道成功: {channel_name} for booking {booking_id}")
        
        return vc
        
    except Exception as e:
        print(f"❌ 創建語音頻道失敗: {e}")
        import traceback
        traceback.print_exc()
        return None

# --- 刪除預約頻道函數 ---
async def delete_booking_channels(booking_id: str):
    """刪除預約相關的 Discord 頻道"""
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return False
        
        # 從資料庫獲取頻道 ID
        with Session() as s:
            # 先檢查欄位是否存在
            check_columns = s.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'Booking' 
                AND column_name IN ('discordTextChannelId', 'discordVoiceChannelId')
            """)).fetchall()
            
            if len(check_columns) < 2:
                print(f"⚠️ Discord 欄位尚未創建，無法獲取頻道資訊")
                return False
            
            result = s.execute(
                text("SELECT \"discordTextChannelId\", \"discordVoiceChannelId\" FROM \"Booking\" WHERE id = :booking_id"),
                {"booking_id": booking_id}
            )
            row = result.fetchone()
            
            if not row:
                print(f"❌ 找不到預約 {booking_id} 的頻道資訊")
                return False
            
            text_channel_id = row[0]
            voice_channel_id = row[1]
        
        deleted_channels = []
        
        # 刪除文字頻道
        if text_channel_id:
            try:
                text_channel = guild.get_channel(int(text_channel_id))
                if text_channel:
                    await text_channel.delete()
                    deleted_channels.append(f"文字頻道 {text_channel.name}")
                    print(f"✅ 已刪除文字頻道: {text_channel.name}")
                else:
                    print(f"⚠️ 文字頻道 {text_channel_id} 不存在")
            except Exception as text_error:
                print(f"❌ 刪除文字頻道失敗: {text_error}")
        
        # 刪除語音頻道
        if voice_channel_id:
            try:
                voice_channel = guild.get_channel(int(voice_channel_id))
                if voice_channel:
                    await voice_channel.delete()
                    deleted_channels.append(f"語音頻道 {voice_channel.name}")
                    print(f"✅ 已刪除語音頻道: {voice_channel.name}")
                else:
                    print(f"⚠️ 語音頻道 {voice_channel_id} 不存在")
            except Exception as voice_error:
                print(f"❌ 刪除語音頻道失敗: {voice_error}")
        
        # 清除資料庫中的頻道 ID
        try:
            with Session() as s:
                # 先檢查欄位是否存在
                check_columns = s.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'Booking' 
                    AND column_name IN ('discordTextChannelId', 'discordVoiceChannelId')
                """)).fetchall()
                
                if len(check_columns) >= 2:
                    s.execute(
                        text("UPDATE \"Booking\" SET \"discordTextChannelId\" = NULL, \"discordVoiceChannelId\" = NULL WHERE id = :booking_id"),
                        {"booking_id": booking_id}
                    )
                    s.commit()
                    print(f"✅ 已清除預約 {booking_id} 的頻道 ID")
                else:
                    print(f"⚠️ Discord 欄位尚未創建，跳過清除頻道 ID")
        except Exception as db_error:
            print(f"❌ 清除頻道 ID 失敗: {db_error}")
        
        # 通知管理員
        try:
            admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
            if admin_channel and deleted_channels:
                await admin_channel.send(
                    f"🗑️ **預約頻道已刪除**\n"
                    f"預約ID: `{booking_id}`\n"
                    f"已刪除頻道: {', '.join(deleted_channels)}"
                )
        except Exception as notify_error:
            print(f"❌ 發送刪除通知失敗: {notify_error}")
        
        return len(deleted_channels) > 0
        
    except Exception as error:
        print(f"❌ 刪除預約頻道失敗: {error}")
        return False

# --- 檢查新預約並創建文字頻道任務 ---
@tasks.loop(seconds=60)  # 每分鐘檢查一次
async def check_new_bookings():
    """檢查新預約並創建文字頻道"""
    await bot.wait_until_ready()
    
    try:
        with Session() as s:
            # 查詢最近 10 分鐘內創建的已確認預約
            now = datetime.now(timezone.utc)
            recent_time = now - timedelta(minutes=10)
            
            # 檢查是否已創建文字頻道
            processed_list = list(processed_text_channels)
            
            # 使用簡化的查詢，在 Python 中過濾已處理的預約
            query = """
            SELECT 
                b.id, b."customerId", b."scheduleId", b.status, b."createdAt", b."updatedAt",
                c.name as customer_name, cu.discord as customer_discord,
                p.name as partner_name, pu.discord as partner_discord,
                s."startTime", s."endTime"
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            JOIN "Customer" c ON c.id = b."customerId"
            JOIN "User" cu ON cu.id = c."userId"
            JOIN "Partner" p ON p.id = s."partnerId"
            JOIN "User" pu ON pu.id = p."userId"
            WHERE b.status IN ('PAID_WAITING_PARTNER_CONFIRMATION', 'PARTNER_ACCEPTED', 'CONFIRMED')
             AND b."createdAt" >= :recent_time
            """
            result = s.execute(text(query), {"recent_time": recent_time})
            
            for row in result:
                try:
                    # 檢查是否已經創建過文字頻道
                    if row.id in processed_text_channels:
                        print(f"⚠️ 預約 {row.id} 已經創建過文字頻道，跳過")
                        continue
                    
                    # 檢查資料庫中是否已經有文字頻道ID
                    with Session() as check_s:
                        existing_channel = check_s.execute(
                            text("SELECT \"discordTextChannelId\" FROM \"Booking\" WHERE id = :booking_id"),
                            {"booking_id": row.id}
                        ).fetchone()
                        
                        if existing_channel and existing_channel[0]:
                            print(f"⚠️ 預約 {row.id} 在資料庫中已有文字頻道ID，跳過")
                            processed_text_channels.add(row.id)
                            continue
                    
                    # 創建文字頻道
                    text_channel = await create_booking_text_channel(
                        row.id, 
                        row.customer_discord, 
                        row.partner_discord, 
                        row.startTime, 
                        row.endTime
                    )
                    
                    if text_channel:
                        # 標記為已處理
                        processed_text_channels.add(row.id)
                        print(f"✅ 已標記預約 {row.id} 為已處理")
                        
                except Exception as e:
                    print(f"❌ 處理新預約 {row.id} 時發生錯誤: {e}")
                    continue
                    
    except Exception as e:
        print(f"❌ 檢查新預約時發生錯誤: {e}")

# --- 自動關閉「現在有空」狀態任務 ---
@tasks.loop(seconds=60)  # 每1分鐘檢查一次
async def auto_close_available_now():
    """自動關閉開啟超過30分鐘的「現在有空」狀態"""
    await bot.wait_until_ready()
    
    try:
        # 計算30分鐘前的時間
        thirty_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=30)
        
        with Session() as s:
            # 查詢開啟「現在有空」超過30分鐘的夥伴
            expired_query = """
            SELECT id, name, "availableNowSince"
            FROM "Partner"
            WHERE "isAvailableNow" = true
            AND "availableNowSince" < :thirty_minutes_ago
            """
            
            expired_partners = s.execute(text(expired_query), {"thirty_minutes_ago": thirty_minutes_ago}).fetchall()
            
            if expired_partners:
                # 批量關閉過期的「現在有空」狀態
                update_query = """
                UPDATE "Partner"
                SET "isAvailableNow" = false, "availableNowSince" = NULL
                WHERE "isAvailableNow" = true
                AND "availableNowSince" < :thirty_minutes_ago
                """
                
                result = s.execute(text(update_query), {"thirty_minutes_ago": thirty_minutes_ago})
                s.commit()
                
                print(f"🕐 自動關閉了 {len(expired_partners)} 個夥伴的「現在有空」狀態")
                for partner in expired_partners:
                    print(f"   - {partner.name} (ID: {partner.id})")
            else:
                # print("🕐 沒有需要自動關閉的「現在有空」狀態")  # 減少日誌輸出
                pass
                
    except Exception as e:
        print(f"❌ 自動關閉「現在有空」狀態時發生錯誤: {e}")

# --- 清理過期頻道任務 ---
@tasks.loop(seconds=300)  # 每5分鐘檢查一次
async def cleanup_expired_channels():
    """清理已過期的預約頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        # 查詢已結束但仍有頻道的預約
        now = datetime.now(timezone.utc)
        
        with Session() as s:
            # 查詢已結束的預約
            expired_query = """
            SELECT 
                b.id, b."discordTextChannelId", b."discordVoiceChannelId",
                s."endTime", b.status
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            WHERE (b."discordTextChannelId" IS NOT NULL OR b."discordVoiceChannelId" IS NOT NULL)
            AND s."endTime" < :now_time
            AND b.status IN ('COMPLETED', 'CANCELLED', 'REJECTED', 'CONFIRMED')
            """
            
            expired_bookings = s.execute(text(expired_query), {"now_time": now}).fetchall()
            
            for booking in expired_bookings:
                booking_id = booking.id
                text_channel_id = booking.discordTextChannelId
                voice_channel_id = booking.discordVoiceChannelId
                
                deleted_channels = []
                
                # 刪除文字頻道
                if text_channel_id:
                    try:
                        text_channel = guild.get_channel(int(text_channel_id))
                        if text_channel:
                            await text_channel.delete()
                            deleted_channels.append(f"文字頻道 {text_channel.name}")
                            print(f"✅ 已清理過期文字頻道: {text_channel.name}")
                    except Exception as e:
                        print(f"❌ 清理文字頻道失敗: {e}")
                
                # 刪除語音頻道
                if voice_channel_id:
                    try:
                        voice_channel = guild.get_channel(int(voice_channel_id))
                        if voice_channel:
                            await voice_channel.delete()
                            deleted_channels.append(f"語音頻道 {voice_channel.name}")
                            print(f"✅ 已清理過期語音頻道: {voice_channel.name}")
                    except Exception as e:
                        print(f"❌ 清理語音頻道失敗: {e}")
                
                # 清除資料庫中的頻道 ID
                if deleted_channels:
                    try:
                        s.execute(
                            text("UPDATE \"Booking\" SET \"discordTextChannelId\" = NULL, \"discordVoiceChannelId\" = NULL WHERE id = :booking_id"),
                            {"booking_id": booking_id}
                        )
                        s.commit()
                        print(f"✅ 已清除預約 {booking_id} 的頻道 ID")
                    except Exception as e:
                        print(f"❌ 清除頻道 ID 失敗: {e}")
        
        # 清理 active_voice_channels 中已結束的頻道
        current_time = datetime.now(timezone.utc)
        expired_vc_ids = []
        
        for vc_id, vc_data in active_voice_channels.items():
            if vc_data['remaining'] <= 0:
                expired_vc_ids.append(vc_id)
        
        for vc_id in expired_vc_ids:
            try:
                vc_data = active_voice_channels[vc_id]
                if 'vc' in vc_data:
                    await vc_data['vc'].delete()
                if 'text_channel' in vc_data and vc_data['text_channel']:
                    await vc_data['text_channel'].delete()
                del active_voice_channels[vc_id]
                print(f"✅ 已清理過期活躍頻道: {vc_id}")
            except Exception as e:
                print(f"❌ 清理活躍頻道失敗: {e}")
                # 即使刪除失敗，也要從字典中移除
                if vc_id in active_voice_channels:
                    del active_voice_channels[vc_id]
        
    except Exception as e:
        print(f"❌ 清理過期頻道時發生錯誤: {e}")

# --- 自動檢查預約任務 ---
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_bookings():
    """定期檢查已付款的預約並創建語音頻道"""
    await bot.wait_until_ready()
    
    try:
        # print(f"🔍 check_bookings 函數開始執行")  # 減少日誌輸出
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        # 查詢已確認且即將開始的預約（只創建語音頻道）
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=30)  # 擴展到過去30分鐘，處理延遲的情況
        window_end = now + timedelta(minutes=10)  # 10分鐘內即將開始
        
        # 查詢即時預約（夥伴確認後延遲開啟）
        instant_window_start = now - timedelta(minutes=10)  # 擴展到過去10分鐘
        instant_window_end = now + timedelta(minutes=10)  # 10分鐘內即將開始
        
        # 使用原生 SQL 查詢避免 orderNumber 欄位問題
        # 添加檢查：只處理還沒有 Discord 頻道的預約
        query = """
        SELECT 
            b.id, b."customerId", b."scheduleId", b.status, b."createdAt", b."updatedAt",
            c.name as customer_name, cu.discord as customer_discord,
            p.name as partner_name, pu.discord as partner_discord,
            s."startTime", s."endTime",
            b."paymentInfo"->>'isInstantBooking' as is_instant_booking,
            b."paymentInfo"->>'discordDelayMinutes' as discord_delay_minutes
        FROM "Booking" b
        JOIN "Schedule" s ON s.id = b."scheduleId"
        JOIN "Customer" c ON c.id = b."customerId"
        JOIN "User" cu ON cu.id = c."userId"
        JOIN "Partner" p ON p.id = s."partnerId"
        JOIN "User" pu ON pu.id = p."userId"
        WHERE b.status IN ('CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED')
        AND s."startTime" >= :start_time_1
        AND s."startTime" <= :start_time_2
        AND b."discordVoiceChannelId" IS NULL
        AND s."endTime" > :current_time
        """
        
        # 即時預約查詢
        instant_query = """
        SELECT 
            b.id, b."customerId", b."scheduleId", b.status, b."createdAt", b."updatedAt",
            c.name as customer_name, cu.discord as customer_discord,
            p.name as partner_name, pu.discord as partner_discord,
            s."startTime", s."endTime",
            b."paymentInfo"->>'isInstantBooking' as is_instant_booking,
            b."paymentInfo"->>'discordDelayMinutes' as discord_delay_minutes
        FROM "Booking" b
        JOIN "Schedule" s ON s.id = b."scheduleId"
        JOIN "Customer" c ON c.id = b."customerId"
        JOIN "User" cu ON cu.id = c."userId"
        JOIN "Partner" p ON p.id = s."partnerId"
        JOIN "User" pu ON pu.id = p."userId"
        WHERE b.status = 'PARTNER_ACCEPTED'
        AND b."paymentInfo"->>'isInstantBooking' = 'true'
        AND s."startTime" >= :instant_start_time_1
        AND s."startTime" <= :instant_start_time_2
        AND b."discordVoiceChannelId" IS NULL
        """
        
        with Session() as s:
            # 查詢一般預約
            result = s.execute(text(query), {"start_time_1": window_start, "start_time_2": window_end, "current_time": now})
            
            # 查詢即時預約
            instant_result = s.execute(text(instant_query), {"instant_start_time_1": instant_window_start, "instant_start_time_2": instant_window_end})
            
            # 添加調試信息（只在有預約時顯示）
            # print(f"🔍 檢查預約時間窗口: {window_start} 到 {window_end}")
            # print(f"🔍 即時預約時間窗口: {instant_window_start} 到 {instant_window_end}")
            # print(f"🔍 當前時間: {now}")
            
            # 合併兩種預約
            all_bookings = []
            
            # 處理一般預約
            general_count = 0
            for row in result:
                general_count += 1
                booking = type('Booking', (), {
                    'id': row.id,
                    'customerId': row.customerId,
                    'scheduleId': row.scheduleId,
                    'status': row.status,
                    'createdAt': row.createdAt,
                    'updatedAt': row.updatedAt,
                    'customer': type('Customer', (), {
                        'user': type('User', (), {
                            'discord': row.customer_discord
                        })()
                    })(),
                    'schedule': type('Schedule', (), {
                        'startTime': row.startTime,
                        'endTime': row.endTime,
                        'partner': type('Partner', (), {
                            'user': type('User', (), {
                                'discord': row.partner_discord
                            })()
                        })()
                    })(),
                    'isInstantBooking': getattr(row, 'is_instant_booking', None),
                    'discordDelayMinutes': getattr(row, 'discord_delay_minutes', None)
                })()
                all_bookings.append(booking)
            
            # 處理即時預約
            instant_count = 0
            for row in instant_result:
                instant_count += 1
                booking = type('Booking', (), {
                    'id': row.id,
                    'customerId': row.customerId,
                    'scheduleId': row.scheduleId,
                    'status': row.status,
                    'createdAt': row.createdAt,
                    'updatedAt': row.updatedAt,
                    'customer': type('Customer', (), {
                        'user': type('User', (), {
                            'discord': row.customer_discord
                        })()
                    })(),
                    'schedule': type('Schedule', (), {
                        'startTime': row.startTime,
                        'endTime': row.endTime,
                        'partner': type('Partner', (), {
                            'user': type('User', (), {
                                'discord': row.partner_discord
                            })()
                        })()
                    })(),
                    'isInstantBooking': getattr(row, 'is_instant_booking', None),
                    'discordDelayMinutes': getattr(row, 'discord_delay_minutes', None)
                })()
                all_bookings.append(booking)
            
            bookings = all_bookings
            
            # 只在有預約需要處理時才顯示
            if len(bookings) > 0:
                print(f"🔍 找到 {general_count} 個一般預約，{instant_count} 個即時預約，總共 {len(bookings)} 個預約需要處理")
            
            for booking in bookings:
                try:
                    print(f"🔍 處理預約 {booking.id}: 狀態={booking.status}, 開始時間={booking.schedule.startTime}, 結束時間={booking.schedule.endTime}")
                    
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
                    
                    # 檢查是否為即時預約
                    is_instant_booking = getattr(booking, 'isInstantBooking', None) == 'true'
                    discord_delay_minutes = int(getattr(booking, 'discordDelayMinutes', 0) or 0)
                    
                    # 創建語音頻道（預約時間前 5 分鐘，即時預約延遲開啟）
                    # 確保時間有時區資訊，並轉換為台灣時間
                    if booking.schedule.startTime.tzinfo is None:
                        start_time = booking.schedule.startTime.replace(tzinfo=timezone.utc)
                    else:
                        start_time = booking.schedule.startTime
                    
                    if booking.schedule.endTime.tzinfo is None:
                        end_time = booking.schedule.endTime.replace(tzinfo=timezone.utc)
                    else:
                        end_time = booking.schedule.endTime
                    
                    # 轉換為台灣時間
                    tw_start_time = start_time.astimezone(TW_TZ)
                    tw_end_time = end_time.astimezone(TW_TZ)
                    
                    # 格式化日期和時間
                    date_str = tw_start_time.strftime("%m/%d")
                    start_time_str = tw_start_time.strftime("%H:%M")
                    end_time_str = tw_end_time.strftime("%H:%M")
                     
                    # 創建統一的頻道名稱（與文字頻道相同）
                    # 嘗試從文字頻道名稱中提取相同的 emoji
                    cute_item = "🎀"  # 預設 emoji
                    try:
                        # 查找對應的文字頻道來獲取相同的 emoji
                        time_pattern = f"{date_str} {start_time_str}-{end_time_str}"
                        for channel in guild.text_channels:
                            if time_pattern in channel.name:
                                # 從文字頻道名稱中提取 emoji
                                import re
                                emoji_match = re.search(r'[🎀🦁🐻🐱🐶🐰🐼🦄🍀⭐🎈🍭🌈🦋🐯🐸🦊🐨🐮🐷]', channel.name)
                                if emoji_match:
                                    cute_item = emoji_match.group()
                                    print(f"✅ 從文字頻道 {channel.name} 提取 emoji: {cute_item}")
                                break
                    except Exception as e:
                        print(f"⚠️ 提取 emoji 失敗，使用預設: {e}")
                    
                    if is_instant_booking:
                        channel_name = f"⚡即時{date_str} {start_time_str}-{end_time_str} {cute_item}"
                    else:
                        channel_name = f"📅{date_str} {start_time_str}-{end_time_str} {cute_item}"
                    
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(view_channel=False),
                        customer_member: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
                        partner_member: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
                    }
                    
                    category = discord.utils.get(guild.categories, name="Voice Channels")
                    if not category:
                        category = discord.utils.get(guild.categories, name="語音頻道")
                    if not category:
                        category = discord.utils.get(guild.categories, name="語音")
                    if not category:
                        # 嘗試使用第一個可用的分類
                        if guild.categories:
                            category = guild.categories[0]
                            print(f"⚠️ 自動檢查使用現有分類: {category.name}")
                        else:
                            print("❌ 找不到任何分類，跳過此預約")
                            continue
                    
                    vc = await guild.create_voice_channel(
                        name=channel_name, 
                        overwrites=overwrites, 
                        user_limit=2, 
                        category=category
                    )
                    
                    # 不創建文字頻道，因為 check_new_bookings 已經創建了
                    # text_channel = await guild.create_text_channel(
                    #     name="🔒匿名文字區", 
                    #     overwrites=overwrites, 
                    #     category=category
                    # )
                    
                    # 創建配對記錄
                    user1_id = str(customer_member.id)
                    user2_id = str(partner_member.id)
                    
                    # 添加調試信息
                    print(f"🔍 自動創建配對記錄: {user1_id} × {user2_id}")
                    
                    record = PairingRecord(
                        user1_id=user1_id,
                        user2_id=user2_id,
                        duration=duration_minutes * 60,
                        animal_name="預約頻道",  # 修正未定義的 animal 變數
                        booking_id=booking.id
                    )
                    s.add(record)
                    s.commit()
                    record_id = record.id  # 保存 ID，避免 Session 關閉後無法訪問
                     
                                        # 初始化頻道狀態
                    active_voice_channels[vc.id] = {
                        'text_channel': None,  # 文字頻道由 check_new_bookings 創建
                        'remaining': duration_minutes * 60,
                        'extended': 0,
                        'record_id': record_id,  # 使用保存的 ID
                        'vc': vc,
                        'booking_id': booking.id
                    }
                    
                    # 保存語音頻道 ID 到資料庫
                    try:
                        with Session() as save_s:
                            # 先檢查欄位是否存在
                            check_column = save_s.execute(text("""
                                SELECT column_name 
                                FROM information_schema.columns 
                                WHERE table_name = 'Booking' 
                                AND column_name = 'discordVoiceChannelId'
                            """)).fetchone()
                            
                            if check_column:
                                # 更新預約記錄，保存 Discord 語音頻道 ID
                                save_s.execute(
                                    text("UPDATE \"Booking\" SET \"discordVoiceChannelId\" = :channel_id WHERE id = :booking_id"),
                                    {"channel_id": str(vc.id), "booking_id": booking.id}
                                )
                                save_s.commit()
                                print(f"✅ 已保存語音頻道 ID {vc.id} 到預約 {booking.id}")
                            else:
                                print(f"⚠️ Discord 語音頻道欄位尚未創建，跳過保存頻道 ID")
                    except Exception as db_error:
                        print(f"❌ 保存語音頻道 ID 到資料庫失敗: {db_error}")
                    
                    # 標記為已處理
                    processed_bookings.add(booking.id)
                    
                    if is_instant_booking:
                        print(f"⚡ 即時預約語音頻道已創建: {channel_name} (預約 {booking.id})")
                        print(f"⏰ Discord 頻道將在 {discord_delay_minutes} 分鐘後自動開啟")
                        
                        # 通知創建頻道頻道
                        channel_creation_channel = bot.get_channel(CHANNEL_CREATION_CHANNEL_ID)
                        if channel_creation_channel:
                            await channel_creation_channel.send(
                                f"⚡ 即時預約語音頻道已創建：\n"
                                f"📋 預約ID: {booking.id}\n"
                                f"👤 顧客: {customer_member.mention} ({customer_discord})\n"
                                f"👥 夥伴: {partner_member.mention} ({partner_discord})\n"
                                f"⏰ 開始時間: {tw_start_time.strftime('%Y/%m/%d %H:%M')}\n"
                                f"⏱️ 時長: {duration_minutes} 分鐘\n"
                                f"🎮 頻道: {vc.mention}\n"
                                f"⏳ 將在 {discord_delay_minutes} 分鐘後自動開啟"
                            )
                        
                        # 延遲開啟語音頻道
                        async def delayed_open_voice():
                            await asyncio.sleep(discord_delay_minutes * 60)  # 等待指定分鐘數
                            try:
                                # 檢查預約狀態是否仍然是 PARTNER_ACCEPTED
                                with Session() as check_s:
                                    current_booking = check_s.execute(
                                        text("SELECT status FROM \"Booking\" WHERE id = :booking_id"),
                                        {"booking_id": booking.id}
                                    ).fetchone()
                                    
                                    if current_booking and current_booking.status == 'PARTNER_ACCEPTED':
                                        # 開啟語音頻道
                                        await vc.set_permissions(guild.default_role, view_channel=True)
                                        # 文字頻道由 check_new_bookings 創建，這裡不需要處理
                                        
                                        # 發送開啟通知
                                        embed = discord.Embed(
                                            title="🎮 即時預約頻道已開啟！",
                                            description=f"歡迎 {customer_member.mention} 和 {partner_member.mention} 來到 {channel_name}！",
                                            color=0x00ff00,
                                            timestamp=datetime.now(timezone.utc)
                                        )
                                        embed.add_field(name="⏰ 預約時長", value=f"{duration_minutes} 分鐘", inline=True)
                                        embed.add_field(name="💰 費用", value=f"${duration_minutes * 2 * 150}", inline=True)  # 假設每半小時150元
                                        
                                        # 文字頻道由 check_new_bookings 創建，這裡不需要發送通知
                                        print(f"✅ 即時預約語音頻道已開啟: {channel_name}")
                                    else:
                                        print(f"⚠️ 預約 {booking.id} 狀態已改變，取消延遲開啟")
                            except Exception as e:
                                print(f"❌ 延遲開啟語音頻道失敗: {e}")
                        
                        # 啟動延遲開啟任務
                        bot.loop.create_task(delayed_open_voice())
                        
                    else:
                        # 通知創建頻道頻道 - 修正時區顯示
                        channel_creation_channel = bot.get_channel(CHANNEL_CREATION_CHANNEL_ID)
                        if channel_creation_channel:
                             # 確保時間有時區資訊，並轉換為台灣時間
                             if booking.schedule.startTime.tzinfo is None:
                                 start_time = booking.schedule.startTime.replace(tzinfo=timezone.utc)
                             else:
                                 start_time = booking.schedule.startTime
                             
                             tw_start_time = start_time.astimezone(TW_TZ)
                             start_time_str = tw_start_time.strftime("%Y/%m/%d %H:%M")
                             
                             await channel_creation_channel.send(
                                 f"🎉 自動創建語音頻道：\n"
                                 f"📋 預約ID: {booking.id}\n"
                                 f"👤 顧客: {customer_member.mention} ({customer_discord})\n"
                                 f"👥 夥伴: {partner_member.mention} ({partner_discord})\n"
                                 f"⏰ 開始時間: {start_time_str}\n"
                                 f"⏱️ 時長: {duration_minutes} 分鐘\n"
                                 f"🎮 頻道: {vc.mention}"
                             )
                        
                        # 啟動倒數計時 - 需要找到對應的文字頻道
                        # 查找對應的文字頻道
                        text_channel = None
                        # 使用更靈活的匹配方式
                        time_pattern = f"{date_str} {start_time_str}-{end_time_str}"
                        
                        for channel in guild.text_channels:
                            # 檢查頻道名稱是否包含時間模式
                            if time_pattern in channel.name:
                                text_channel = channel
                                print(f"✅ 找到對應的文字頻道: {channel.name}")
                                break
                        
                        if text_channel:
                            # 啟動倒數計時和評價系統
                            bot.loop.create_task(
                                countdown_with_rating(vc.id, channel_name, text_channel, vc, None, [customer_member, partner_member], record_id, booking.id)
                            )
                            print(f"✅ 已啟動倒數計時和評價系統: {channel_name}")
                        else:
                            print(f"⚠️ 找不到對應的文字頻道: {channel_name}")
                            # 如果找不到文字頻道，創建一個臨時的
                            try:
                                text_channel = await guild.create_text_channel(
                                    name=f"📝{date_str}-{start_time_str}-{end_time_str}",
                                    overwrites={
                                        guild.default_role: discord.PermissionOverwrite(view_channel=False),
                                        customer_member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
                                        partner_member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True),
                                    },
                                    category=category
                                )
                                print(f"✅ 創建臨時文字頻道: {text_channel.name}")
                                
                                # 啟動倒數計時和評價系統
                                bot.loop.create_task(
                                    countdown_with_rating(vc.id, channel_name, text_channel, vc, None, [customer_member, partner_member], record_id, booking.id)
                                )
                                print(f"✅ 已啟動倒數計時和評價系統: {channel_name}")
                            except Exception as e:
                                print(f"❌ 創建臨時文字頻道失敗: {e}")
                         
                        print(f"✅ 自動創建頻道成功: {channel_name} for booking {booking.id}")
                    
                except Exception as e:
                    print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
                    continue
                    
    except Exception as e:
        print(f"❌ 檢查預約時發生錯誤: {e}")

# --- 發送評價到管理員頻道 ---
async def send_rating_to_admin(record_id, rating_data, user1_id, user2_id):
    """發送評價結果到管理員頻道"""
    try:
        admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
        if not admin_channel:
            print(f"❌ 找不到管理員頻道 (ID: {ADMIN_CHANNEL_ID})")
            return
        
        # 獲取用戶資訊
        try:
            from_user = await bot.fetch_user(int(rating_data['user1']))
            from_user_display = from_user.display_name
        except:
            from_user_display = f"用戶 {rating_data['user1']}"
        
        try:
            to_user = await bot.fetch_user(int(rating_data['user2']))
            to_user_display = to_user.display_name
        except:
            to_user_display = f"用戶 {rating_data['user2']}"
        
        # 創建評價嵌入訊息
        embed = discord.Embed(
            title="⭐ 新評價回饋",
            color=0x00ff00,
            timestamp=datetime.now(timezone.utc)
        )
        
        embed.add_field(
            name="👤 評價者",
            value=from_user_display,
            inline=True
        )
        
        embed.add_field(
            name="👤 被評價者", 
            value=to_user_display,
            inline=True
        )
        
        embed.add_field(
            name="⭐ 評分",
            value="⭐" * rating_data['rating'],
            inline=True
        )
        
        if rating_data['comment']:
            embed.add_field(
                name="💬 留言",
                value=rating_data['comment'],
                inline=False
            )
        
        embed.add_field(
            name="📋 配對記錄ID",
            value=f"`{record_id}`",
            inline=True
        )
        
        embed.set_footer(text="PeiPlay 評價系統")
        
        await admin_channel.send(embed=embed)
        print(f"✅ 評價已發送到管理員頻道: {from_user_display} → {to_user_display} ({rating_data['rating']}⭐)")
        
    except Exception as e:
        print(f"❌ 發送評價到管理員頻道失敗: {e}")
        import traceback
        traceback.print_exc()

# --- 評分 Modal ---
class RatingModal(Modal, title="匿名評分與留言"):
    rating = TextInput(label="給予評分（1～5 星）", required=True)
    comment = TextInput(label="留下你的留言（選填）", required=False)

    def __init__(self, record_id):
        super().__init__()
        self.record_id = record_id

    async def on_submit(self, interaction: discord.Interaction):
        try:
            print(f"🔍 收到評價提交: record_id={self.record_id}, rating={self.rating}, comment={self.comment}")
            
            # 使用新的 session 來避免連接問題
            with Session() as s:
                record = s.get(PairingRecord, self.record_id)
                if not record:
                    print(f"❌ 找不到配對記錄: {self.record_id}")
                    await interaction.response.send_message("❌ 找不到配對記錄", ephemeral=True)
                    return
                
                # 在 session 內獲取需要的資料
                user1_id = record.user1_id
                user2_id = record.user2_id
                
                print(f"🔍 配對記錄資訊: user1_id={user1_id}, user2_id={user2_id}")
                
                record.rating = int(str(self.rating))
                record.comment = str(self.comment)
                s.commit()
                print(f"✅ 評價已保存到資料庫")
            
            await interaction.response.send_message("✅ 感謝你的匿名評價！", ephemeral=True)

            if self.record_id not in pending_ratings:
                pending_ratings[self.record_id] = []
            
            rating_data = {
                'rating': int(str(self.rating)),
                'comment': str(self.comment),
                'user1': str(interaction.user.id),
                'user2': str(user2_id if str(interaction.user.id) == user1_id else user1_id)
            }
            pending_ratings[self.record_id].append(rating_data)
            print(f"✅ 評價已添加到待處理列表: {rating_data}")

            # 立即發送評價到管理員頻道
            await send_rating_to_admin(self.record_id, rating_data, user1_id, user2_id)

            evaluated_records.add(self.record_id)
            print(f"✅ 評價流程完成")
        except Exception as e:
            print(f"❌ 評分提交錯誤: {e}")
            import traceback
            traceback.print_exc()
            try:
                await interaction.response.send_message("❌ 提交失敗，請稍後再試", ephemeral=True)
            except:
                # 如果已經回應過，就忽略錯誤
                pass

# --- 延長按鈕 ---
class RatingView(View):
    def __init__(self, booking_id):
        super().__init__(timeout=600)  # 10 分鐘超時
        self.booking_id = booking_id
        self.ratings = {}  # 儲存用戶的評分

    @discord.ui.button(label="⭐ 1星", style=discord.ButtonStyle.secondary, custom_id="rating_1")
    async def rate_1_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 1)

    @discord.ui.button(label="⭐⭐ 2星", style=discord.ButtonStyle.secondary, custom_id="rating_2")
    async def rate_2_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 2)

    @discord.ui.button(label="⭐⭐⭐ 3星", style=discord.ButtonStyle.secondary, custom_id="rating_3")
    async def rate_3_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 3)

    @discord.ui.button(label="⭐⭐⭐⭐ 4星", style=discord.ButtonStyle.secondary, custom_id="rating_4")
    async def rate_4_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 4)

    @discord.ui.button(label="⭐⭐⭐⭐⭐ 5星", style=discord.ButtonStyle.secondary, custom_id="rating_5")
    async def rate_5_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 5)

    async def handle_rating(self, interaction: discord.Interaction, rating: int):
        user_id = interaction.user.id
        self.ratings[user_id] = rating
        
        # 更新按鈕樣式
        for item in self.children:
            if isinstance(item, discord.ui.Button):
                if item.custom_id == f"rating_{rating}":
                    item.style = discord.ButtonStyle.success
                    item.label = f"✅ {item.label}"
                else:
                    item.style = discord.ButtonStyle.secondary
                    # 移除其他按鈕的 ✅ 標記
                    if item.label.startswith("✅ "):
                        item.label = item.label[2:]
        
        await interaction.response.edit_message(view=self)
        
        # 發送評論輸入提示
        await interaction.followup.send(
            f"✅ 您已選擇 {rating} 星評分！\n"
            f"請在下方輸入您的評論：",
            ephemeral=True
        )

    @discord.ui.button(label="💬 提交評論", style=discord.ButtonStyle.primary, custom_id="submit_comment")
    async def submit_comment(self, interaction: discord.Interaction, button: discord.ui.Button):
        user_id = interaction.user.id
        if user_id not in self.ratings:
            await interaction.response.send_message("❌ 請先選擇星等評分！", ephemeral=True)
            return
        
        # 創建模態對話框來輸入評論
        modal = CommentModal(self.ratings[user_id], self.booking_id)
        await interaction.response.send_modal(modal)

class CommentModal(discord.ui.Modal):
    def __init__(self, rating: int, booking_id: str):
        super().__init__(title="提交評價")
        self.rating = rating
        self.booking_id = booking_id
        
        self.comment_input = discord.ui.TextInput(
            label="評論內容",
            placeholder="請輸入您對這次遊戲體驗的評論...",
            style=discord.TextStyle.paragraph,
            required=False,
            max_length=500
        )
        self.add_item(self.comment_input)

    async def on_submit(self, interaction: discord.Interaction):
        comment = self.comment_input.value or "無評論"
        
        # 獲取顧客和夥伴信息
        try:
            with Session() as s:
                result = s.execute(text("""
                    SELECT 
                        c.name as customer_name, p.name as partner_name,
                        cu.discord as customer_discord, pu.discord as partner_discord
                    FROM "Booking" b
                    JOIN "Schedule" s ON s.id = b."scheduleId"
                    JOIN "Customer" c ON c.id = b."customerId"
                    JOIN "User" cu ON cu.id = c."userId"
                    JOIN "Partner" p ON p.id = s."partnerId"
                    JOIN "User" pu ON pu.id = p."userId"
                    WHERE b.id = :booking_id
                """), {"booking_id": self.booking_id}).fetchone()
                
                if result:
                    # 發送到管理員頻道
                    admin_channel = bot.get_channel(1419601068110778450)  # 管理員頻道 ID
                    if admin_channel:
                        await admin_channel.send(
                            f"**{result.customer_name}** 評價 **{result.partner_name}**\n"
                            f"⭐ {'⭐' * self.rating}\n"
                            f"💬 {comment}"
                        )
                        print(f"✅ 評價已發送到管理員頻道: {result.customer_name} → {result.partner_name} ({self.rating}⭐)")
                    
                    # 確認收到評價
                    await interaction.response.send_message(
                        f"✅ 感謝您的評價！\n"
                        f"評分：{'⭐' * self.rating}\n"
                        f"評論：{comment}",
                        ephemeral=True
                    )
                else:
                    await interaction.response.send_message("❌ 找不到對應的預約記錄", ephemeral=True)
        except Exception as e:
            print(f"❌ 處理評價提交失敗: {e}")
            await interaction.response.send_message("❌ 處理評價時發生錯誤，請稍後再試", ephemeral=True)

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
async def cleanup_duplicate_channels():
    """清理重複的頻道"""
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        print("🔍 開始清理重複頻道...")
        
        # 獲取所有文字頻道
        text_channels = [ch for ch in guild.channels if isinstance(ch, discord.TextChannel)]
        
        # 統計頻道名稱
        channel_names = {}
        for channel in text_channels:
            name = channel.name
            if name not in channel_names:
                channel_names[name] = []
            channel_names[name].append(channel)
        
        # 找出重複的頻道
        duplicate_channels = []
        for name, channels in channel_names.items():
            if len(channels) > 1:
                print(f"🔍 發現重複頻道: {name} (共 {len(channels)} 個)")
                # 保留第一個，刪除其他的
                for i, channel in enumerate(channels[1:], 1):
                    duplicate_channels.append(channel)
                    print(f"  - 將刪除: {channel.name} (ID: {channel.id})")
        
        if not duplicate_channels:
            print("✅ 沒有發現重複頻道")
        else:
            print(f"🗑️ 準備刪除 {len(duplicate_channels)} 個重複頻道...")
            
            # 刪除重複頻道
            deleted_count = 0
            for channel in duplicate_channels:
                try:
                    await channel.delete()
                    deleted_count += 1
                    print(f"✅ 已刪除頻道: {channel.name}")
                except Exception as e:
                    print(f"❌ 刪除頻道失敗 {channel.name}: {e}")
            
            print(f"🎉 清理完成！共刪除 {deleted_count} 個重複頻道")
            
    except Exception as e:
        print(f"❌ 清理重複頻道時發生錯誤: {e}")

@bot.event
async def on_ready():
    print(f"✅ Bot 上線：{bot.user}")
    try:
        guild = discord.Object(id=GUILD_ID)
        synced = await bot.tree.sync(guild=guild)
        print(f"✅ Slash 指令已同步：{len(synced)} 個指令")
        
        # 清理重複頻道
        await cleanup_duplicate_channels()
        
        # 啟動自動檢查任務
        check_bookings.start()
        check_new_bookings.start()
        cleanup_expired_channels.start()
        auto_close_available_now.start()
        print(f"✅ 自動檢查預約任務已啟動，檢查間隔：{CHECK_INTERVAL} 秒")
        print(f"✅ 新預約文字頻道檢查任務已啟動，檢查間隔：60 秒")
        print(f"✅ 清理過期頻道任務已啟動，檢查間隔：300 秒")
        print(f"✅ 自動關閉「現在有空」任務已啟動，檢查間隔：60 秒")
    except Exception as e:
        print(f"❌ 指令同步失敗: {e}")

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return
    
    # 評價系統現在使用按鈕和模態對話框，不需要處理文字訊息
    
    if message.content == "!ping":
        await message.channel.send("Pong!")
    await bot.process_commands(message)


# --- 倒數邏輯 ---
async def countdown_with_rating(vc_id, channel_name, text_channel, vc, mentioned, members, record_id, booking_id):
    """倒數計時函數，包含評價系統"""
    try:
        # 計算預約結束時間
        now = datetime.now(timezone.utc)
        
        # 從資料庫獲取預約結束時間
        with Session() as s:
            result = s.execute(text("""
                SELECT s."endTime" 
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                WHERE b.id = :booking_id
            """), {"booking_id": booking_id}).fetchone()
            
            if not result:
                print(f"❌ 找不到預約 {booking_id} 的結束時間")
                return
                
            end_time = result[0]
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
        
        # 計算等待時間
        wait_seconds = (end_time - now).total_seconds()
        
        if wait_seconds > 0:
            print(f"⏰ 等待 {wait_seconds} 秒後開始評價系統...")
            await asyncio.sleep(wait_seconds)
        
        # 預約時間結束，關閉語音頻道
        try:
            await vc.delete()
            print(f"✅ 已關閉語音頻道: {channel_name}")
        except Exception as e:
            print(f"❌ 關閉語音頻道失敗: {e}")
        
        # 在文字頻道顯示評價系統
        view = RatingView(booking_id)
        await text_channel.send(
            "🎉 預約時間結束！\n"
            "請為您的遊戲夥伴評分：\n\n"
            "點擊下方按鈕選擇星等，然後在評論框中輸入您的評論。",
            view=view
        )
        
        # 等待 10 分鐘讓用戶填寫評價
        await asyncio.sleep(600)  # 10 分鐘 = 600 秒
        
        # 10 分鐘後關閉文字頻道
        try:
            await text_channel.delete()
            print(f"✅ 已關閉文字頻道: {text_channel.name}")
        except Exception as e:
            print(f"❌ 關閉文字頻道失敗: {e}")
            
    except Exception as e:
        print(f"❌ countdown_with_rating 函數錯誤: {e}")

async def countdown(vc_id, animal_channel_name, text_channel, vc, interaction, mentioned, record_id):
    try:
        print(f"🔍 開始倒數計時: vc_id={vc_id}, record_id={record_id}")
        
        # 檢查 record_id 是否有效
        if not record_id:
            print(f"❌ 警告: record_id 為 None，評價系統可能無法正常工作")
        
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
        print(f"🎯 語音頻道已刪除，開始評價流程: record_id={record_id}")
        
        # 發送評價提示訊息
        embed = discord.Embed(
            title="⭐ 預約結束 - 請進行評價",
            description="感謝您使用 PeiPlay 服務！請花一點時間為您的夥伴進行匿名評價。",
            color=0xffd700
        )
        embed.add_field(
            name="📝 評價說明",
            value="• 評分範圍：1-5 星\n• 留言為選填項目\n• 評價完全匿名\n• 評價結果會回報給管理員",
            inline=False
        )
        embed.set_footer(text="評價有助於我們提供更好的服務品質")
        
        await text_channel.send(embed=embed)
        await text_channel.send("📝 請點擊以下按鈕進行匿名評分：")

        class SubmitButton(View):
            def __init__(self):
                super().__init__(timeout=600)  # 延長到10分鐘
                self.clicked = False

            @discord.ui.button(label="⭐ 匿名評分", style=discord.ButtonStyle.success, emoji="⭐")
            async def submit(self, interaction: discord.Interaction, button: Button):
                print(f"🔍 用戶 {interaction.user.id} 點擊了評價按鈕")
                if self.clicked:
                    await interaction.response.send_message("❗ 已提交過評價。", ephemeral=True)
                    return
                self.clicked = True
                await interaction.response.send_modal(RatingModal(record_id))

        await text_channel.send(view=SubmitButton())
        print(f"⏰ 評價按鈕已發送，等待 600 秒後刪除文字頻道")
        await asyncio.sleep(600)  # 延長到10分鐘，給用戶更多時間評價
        await text_channel.delete()
        print(f"🗑️ 文字頻道已刪除，評價流程結束")

        # 使用新的 session 來更新記錄
        with Session() as s:
            record = s.get(PairingRecord, record_id)
            if record:
                record.extended_times = active_voice_channels[vc_id]['extended']
                record.duration += record.extended_times * 600
                s.commit()
                
                # 獲取更新後的記錄資訊
                user1_id = record.user1_id
                user2_id = record.user2_id
                duration = record.duration
                extended_times = record.extended_times
                booking_id = record.booking_id

        admin = bot.get_channel(ADMIN_CHANNEL_ID)
        if admin:
            try:
                # 嘗試獲取用戶資訊，如果失敗則使用用戶 ID
                try:
                    u1 = await bot.fetch_user(int(user1_id))
                    user1_display = u1.mention
                except:
                    user1_display = f"<@{user1_id}>"
                
                try:
                    u2 = await bot.fetch_user(int(user2_id))
                    user2_display = u2.mention
                except:
                    user2_display = f"<@{user2_id}>"
                
                header = f"📋 配對紀錄：{user1_display} × {user2_display} | {duration//60} 分鐘 | 延長 {extended_times} 次"
                
                if booking_id:
                    header += f" | 預約ID: {booking_id}"

                if record_id in pending_ratings:
                    feedback = "\n⭐ 評價回饋："
                    for r in pending_ratings[record_id]:
                        try:
                            from_user = await bot.fetch_user(int(r['user1']))
                            from_user_display = from_user.mention
                        except:
                            from_user_display = f"<@{r['user1']}>"
                        
                        try:
                            to_user = await bot.fetch_user(int(r['user2']))
                            to_user_display = to_user.mention
                        except:
                            to_user_display = f"<@{r['user2']}>"
                        
                        feedback += f"\n- 「{from_user_display} → {to_user_display}」：{r['rating']} ⭐"
                        if r['comment']:
                            feedback += f"\n  💬 {r['comment']}"
                    del pending_ratings[record_id]
                    await admin.send(f"{header}{feedback}")
                else:
                    await admin.send(f"{header}\n⭐ 沒有收到任何評價。")
            except Exception as e:
                print(f"推送管理區評價失敗：{e}")
                # 如果完全失敗，至少顯示基本的配對資訊
                try:
                    basic_header = f"📋 配對紀錄：用戶 {user1_id} × 用戶 {user2_id} | {duration//60} 分鐘 | 延長 {extended_times} 次"
                    if booking_id:
                        basic_header += f" | 預約ID: {booking_id}"
                    await admin.send(f"{basic_header}\n⭐ 沒有收到任何評價。")
                except:
                    pass

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
    
    # 確保不會與自己配對
    mentioned = [m for m in mentioned if m.id != interaction.user.id]
    if not mentioned:
        await interaction.followup.send("❗請標註其他成員，不能與自己配對。")
        return

    animal = random.choice(CUTE_ITEMS)
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

        with Session() as s:
            # 確保記錄兩個不同的用戶
            user1_id = str(interaction.user.id)
            user2_id = str(mentioned[0].id)
            
            # 添加調試信息
            print(f"🔍 創建配對記錄: {user1_id} × {user2_id}")
            
            record = PairingRecord(
                user1_id=user1_id,
                user2_id=user2_id,
                duration=minutes * 60,
                animal_name=animal
            )
            s.add(record)
            s.commit()
            record_id = record.id  # 保存 ID，避免 Session 關閉後無法訪問

        active_voice_channels[vc.id] = {
            'text_channel': text_channel,
            'remaining': minutes * 60,
            'extended': 0,
            'record_id': record_id,  # 使用保存的 ID
            'vc': vc
        }

        await countdown(vc.id, animal_channel_name, text_channel, vc, interaction, mentioned, record_id)

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
    with Session() as s:
        records = s.query(PairingRecord).filter((PairingRecord.user1_id==str(interaction.user.id)) | (PairingRecord.user2_id==str(interaction.user.id))).all()
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
    with Session() as s:
        records = s.query(PairingRecord).filter((PairingRecord.user1_id==str(member.id)) | (PairingRecord.user2_id==str(member.id))).all()
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

@app.route("/pair", methods=["POST"])
def pair_users():
    data = request.get_json()
    user1_discord_name = data.get("user1_id")  # 實際上是 Discord 名稱
    user2_discord_name = data.get("user2_id")  # 實際上是 Discord 名稱
    minutes = data.get("minutes", 60)
    start_time = data.get("start_time")  # 可選的開始時間

    print(f"🔍 收到配對請求: {user1_discord_name} × {user2_discord_name}, {minutes} 分鐘")

    async def create_pairing():
        try:
            guild = bot.get_guild(GUILD_ID)
            if not guild:
                print("❌ 找不到伺服器")
                return

            # 根據 Discord 名稱查找用戶
            user1 = find_member_by_discord_name(guild, user1_discord_name)
            user2 = find_member_by_discord_name(guild, user2_discord_name)
            
            if not user1 or not user2:
                print(f"❌ 找不到用戶: {user1_discord_name}, {user2_discord_name}")
                print(f"🔍 伺服器中的成員: {[m.name for m in guild.members]}")
                return

            print(f"✅ 找到用戶: {user1.name} ({user1.id}), {user2.name} ({user2.id})")

            # 生成可愛物品名稱
            animal = random.choice(CUTE_ITEMS)
            channel_name = f"{animal}頻道"

            # 創建語音頻道 - 嘗試多種分類名稱
            category = discord.utils.get(guild.categories, name="Voice Channels")
            if not category:
                category = discord.utils.get(guild.categories, name="語音頻道")
            if not category:
                category = discord.utils.get(guild.categories, name="語音")
            if not category:
                # 嘗試使用第一個可用的分類
                if guild.categories:
                    category = guild.categories[0]
                    print(f"⚠️ 使用現有分類: {category.name}")
                else:
                    print("❌ 找不到任何分類，請在 Discord 伺服器中創建分類")
                    return

            # 設定權限
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(view_channel=False),
                user1: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
                user2: discord.PermissionOverwrite(view_channel=True, connect=True, speak=True),
            }

            # 創建文字頻道（立即創建）
            text_channel = await guild.create_text_channel(
                name=f"{animal}聊天",
                category=category,
                overwrites=overwrites
            )

            # 如果有開始時間，則排程創建語音頻道
            if start_time:
                try:
                    # 解析開始時間
                    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                    now = datetime.now(timezone.utc)
                    delay_seconds = (start_dt - now).total_seconds()
                    
                    if delay_seconds > 300:  # 如果超過5分鐘
                        # 發送5分鐘提醒
                        reminder_time = start_dt - timedelta(minutes=5)
                        reminder_delay = (reminder_time - now).total_seconds()
                        
                        if reminder_delay > 0:
                            await asyncio.sleep(reminder_delay)
                            await text_channel.send(f"⏰ **預約提醒**\n🎮 您的語音頻道將在 5 分鐘後開啟！\n👥 參與者：{user1.mention} 和 {user2.mention}\n⏰ 開始時間：<t:{int(start_dt.timestamp())}:t>")
                    
                    # 等待到開始時間
                    if delay_seconds > 0:
                        await asyncio.sleep(delay_seconds)
                    
                    # 創建語音頻道
                    voice_channel = await guild.create_voice_channel(
                        name=channel_name,
                        category=category,
                        user_limit=2,
                        overwrites=overwrites
                    )
                    
                    # 移動用戶到語音頻道
                    if user1.voice:
                        await user1.move_to(voice_channel)
                    if user2.voice:
                        await user2.move_to(voice_channel)
                    
                    # 發送歡迎訊息（與手動創建相同）
                    await text_channel.send(f"🎉 語音頻道 {channel_name} 已開啟！\n⏳ 可延長10分鐘 ( 為了您有更好的遊戲體驗，請到最後需要時再點選 ) 。")
                    
                    print(f"✅ 成功創建排程配對頻道: {channel_name}")
                    
                except Exception as e:
                    print(f"❌ 排程創建頻道失敗: {e}")
                    await text_channel.send("❌ 創建語音頻道時發生錯誤，請聯繫管理員。")
            else:
                # 立即創建語音頻道
                voice_channel = await guild.create_voice_channel(
                    name=channel_name,
                    category=category,
                    user_limit=2,
                    overwrites=overwrites
                )
                
                # 移動用戶到語音頻道
                if user1.voice:
                    await user1.move_to(voice_channel)
                if user2.voice:
                    await user2.move_to(voice_channel)
                
                # 發送歡迎訊息
                await text_channel.send(f"🎮 歡迎 {user1.mention} 和 {user2.mention} 來到 {channel_name}！\n⏰ 時長：{minutes} 分鐘")
                
                print(f"✅ 成功創建即時配對頻道: {channel_name}")

        except Exception as e:
            print(f"❌ 創建配對頻道失敗: {e}")
            import traceback
            traceback.print_exc()

    bot.loop.create_task(create_pairing())
    return jsonify({"status": "ok", "message": "配對請求已處理"})

@app.route('/delete', methods=['POST'])
def delete_booking():
    """刪除預約相關的 Discord 頻道"""
    try:
        data = request.get_json()
        booking_id = data.get('booking_id')
        
        if not booking_id:
            return jsonify({'error': '缺少預約 ID'}), 400
        
        # 使用 asyncio 運行 Discord 操作
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                delete_booking_channels(booking_id)
            )
            loop.close()
            
            if result:
                return jsonify({'success': True, 'message': '頻道已成功刪除'})
            else:
                return jsonify({'error': '刪除頻道失敗'}), 500
        except Exception as e:
            loop.close()
            return jsonify({'error': f'Discord 操作失敗: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': f'刪除預約失敗: {str(e)}'}), 500

def run_flask():
    app.run(host="0.0.0.0", port=5001)

threading.Thread(target=run_flask, daemon=True).start()
bot.run(TOKEN) 