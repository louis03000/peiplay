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
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))
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
        
        # 保存頻道 ID 到資料庫
        try:
            with Session() as s:
                # 更新預約記錄，保存 Discord 頻道 ID
                result = s.execute(
                    text("UPDATE \"Booking\" SET \"discordTextChannelId\" = :channel_id WHERE id = :booking_id"),
                    {"channel_id": str(text_channel.id), "booking_id": booking_id}
                )
                s.commit()
                print(f"✅ 已保存文字頻道 ID {text_channel.id} 到預約 {booking_id}")
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
                s.execute(
                    text("UPDATE \"Booking\" SET \"discordTextChannelId\" = NULL, \"discordVoiceChannelId\" = NULL WHERE id = :booking_id"),
                    {"booking_id": booking_id}
                )
                s.commit()
                print(f"✅ 已清除預約 {booking_id} 的頻道 ID")
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
            
            if processed_list:
                # 如果有已處理的預約，使用 NOT IN 查詢
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
                WHERE b.status = 'CONFIRMED'
                AND b."createdAt" >= :recent_time
                AND b.id NOT IN (SELECT unnest(:processed_list::text[]))
                """
                result = s.execute(text(query), {"recent_time": recent_time, "processed_list": processed_list})
            else:
                # 如果沒有已處理的預約，簡化查詢
                simple_query = """
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
                WHERE b.status = 'CONFIRMED'
                AND b."createdAt" >= :recent_time
                """
                result = s.execute(text(simple_query), {"recent_time": recent_time})
            
            for row in result:
                try:
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
                        
                except Exception as e:
                    print(f"❌ 處理新預約 {row.id} 時發生錯誤: {e}")
                    continue
                    
    except Exception as e:
        print(f"❌ 檢查新預約時發生錯誤: {e}")

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
        
        # 查詢已確認且即將開始的預約（只創建語音頻道）
        now = datetime.now(timezone.utc)
        window_start = now
        window_end = now + timedelta(minutes=5)  # 5分鐘內即將開始
        
        with Session() as s:
            # 使用原生 SQL 查詢避免 orderNumber 欄位問題
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
            WHERE b.status IN ('CONFIRMED', 'COMPLETED')
            AND b.id NOT IN (SELECT unnest(%s::text[]))
            AND s."startTime" >= %s
            AND s."startTime" <= %s
            """
            
            # 將 processed_bookings 轉換為列表
            processed_list = list(processed_bookings) if processed_bookings else []
            
            # 修正參數傳遞格式
            if processed_list:
                # 如果有已處理的預約，使用 NOT IN 查詢
                result = s.execute(text(query), {"processed_list": processed_list, "start_time_1": window_start, "start_time_2": window_end})
            else:
                # 如果沒有已處理的預約，簡化查詢
                simple_query = """
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
                WHERE b.status IN ('CONFIRMED', 'COMPLETED')
                AND s."startTime" >= :start_time_1
                AND s."startTime" <= :start_time_2
                """
                result = s.execute(text(simple_query), {"start_time_1": window_start, "start_time_2": window_end})
            
            bookings = []
            for row in result:
                # 創建一個簡單的物件來模擬 Booking 物件
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
                    })()
                })()
                bookings.append(booking)
            
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
                    
                    # 創建語音頻道（預約時間前 5 分鐘）
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
                    cute_item = random.choice(CUTE_ITEMS)
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
                    
                    text_channel = await guild.create_text_channel(
                        name="🔒匿名文字區", 
                        overwrites=overwrites, 
                        category=category
                    )
                    
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
                        'text_channel': text_channel,
                        'remaining': duration_minutes * 60,
                        'extended': 0,
                        'record_id': record_id,  # 使用保存的 ID
                        'vc': vc,
                        'booking_id': booking.id
                    }
                    
                    # 標記為已處理
                    processed_bookings.add(booking.id)
                    
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
                    
                    # 啟動倒數
                    bot.loop.create_task(
                        countdown(vc.id, channel_name, text_channel, vc, None, [customer_member, partner_member], record_id)
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
            # 使用新的 session 來避免連接問題
            with Session() as s:
                record = s.get(PairingRecord, self.record_id)
                if not record:
                    await interaction.response.send_message("❌ 找不到配對記錄", ephemeral=True)
                    return
                
                # 在 session 內獲取需要的資料
                user1_id = record.user1_id
                user2_id = record.user2_id
                
                record.rating = int(str(self.rating))
                record.comment = str(self.comment)
                s.commit()
            
            await interaction.response.send_message("✅ 感謝你的匿名評價！", ephemeral=True)

            if self.record_id not in pending_ratings:
                pending_ratings[self.record_id] = []
            pending_ratings[self.record_id].append({
                'rating': int(str(self.rating)),
                'comment': str(self.comment),
                'user1': str(interaction.user.id),
                'user2': str(user2_id if str(interaction.user.id) == user1_id else user1_id)
            })

            evaluated_records.add(self.record_id)
        except Exception as e:
            print(f"❌ 評分提交錯誤: {e}")
            try:
                await interaction.response.send_message("❌ 提交失敗，請稍後再試", ephemeral=True)
            except:
                # 如果已經回應過，就忽略錯誤
                pass

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
        check_new_bookings.start()
        print(f"✅ 自動檢查預約任務已啟動，檢查間隔：{CHECK_INTERVAL} 秒")
        print(f"✅ 新預約文字頻道檢查任務已啟動，檢查間隔：60 秒")
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
async def countdown(vc_id, animal_channel_name, text_channel, vc, interaction, mentioned, record_id):
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
                await interaction.response.send_modal(RatingModal(record_id))

        await text_channel.send(view=SubmitButton())
        await asyncio.sleep(300)
        await text_channel.delete()

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