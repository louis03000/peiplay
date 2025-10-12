import discord
from discord.ext import commands, tasks
from flask import Flask, request, jsonify
import sqlalchemy
from sqlalchemy import create_engine, text, Column, String, Integer, Float, DateTime, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta, timezone
import hashlib
import random
import asyncio
import os
from dotenv import load_dotenv
import requests
import json
import time
from typing import Optional

# 載入環境變數
load_dotenv()

# Discord Bot 設定
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.voice_channels = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)

# 從環境變數獲取 Discord Token
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
GUILD_ID = int(os.getenv('DISCORD_GUILD_ID', '0'))
ADMIN_CHANNEL_ID = int(os.getenv('ADMIN_CHANNEL_ID', '0'))
ADMIN_USER_ID = int(os.getenv('ADMIN_USER_ID', '0'))

# 檢查必要的環境變數
if not DISCORD_TOKEN:
    print("❌ 錯誤：未找到 DISCORD_TOKEN 環境變數")
    exit(1)

if GUILD_ID == 0:
    print("❌ 錯誤：未找到 DISCORD_GUILD_ID 環境變數")
    exit(1)

if ADMIN_CHANNEL_ID == 0:
    print("❌ 錯誤：未找到 ADMIN_CHANNEL_ID 環境變數")
    exit(1)

if ADMIN_USER_ID == 0:
    print("❌ 錯誤：未找到 ADMIN_USER_ID 環境變數")
    exit(1)

print(f"✅ Discord Token: {DISCORD_TOKEN[:10]}...")
print(f"✅ Guild ID: {GUILD_ID}")
print(f"✅ Admin Channel ID: {ADMIN_CHANNEL_ID}")
print(f"✅ Admin User ID: {ADMIN_USER_ID}")

# 資料庫設定
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ 錯誤：未找到 DATABASE_URL 環境變數")
    exit(1)

try:
    engine = create_engine(DATABASE_URL)
    print("✅ 資料庫連線成功")
except Exception as e:
    print(f"❌ 資料庫連線失敗: {e}")
    exit(1)

# 創建 Session 類
Session = sessionmaker(bind=engine)

# 可愛物品列表
CUTE_ITEMS = [
    "蝴蝶結", "小狗", "小貓", "小熊", "小兔", "小鳥", "小魚", "小花", 
    "小樹", "小星", "小月", "小太陽", "小雲", "小彩虹", "小愛心",
    "小鑽石", "小皇冠", "小翅膀", "小鈴鐺", "小糖果", "小蛋糕",
    "小冰淇淋", "小氣球", "小禮物", "小寶石", "小珍珠", "小貝殼"
]

# 檢查間隔（秒）
CHECK_INTERVAL = 30

# 創建 Discord 頻道的函數
def create_booking_text_channel(guild, booking_id, customer_name, partner_name, is_instant_booking=False):
    """創建預約文字頻道"""
    try:
        # 使用 MD5 雜湊確保一致性
        hash_obj = hashlib.md5(booking_id.encode())
        hash_hex = hash_obj.hexdigest()
        cute_item = CUTE_ITEMS[int(hash_hex[:2], 16) % len(CUTE_ITEMS)]
        
        if is_instant_booking:
            channel_name = f"🔥{cute_item}-{customer_name}-{partner_name}"
            else:
            channel_name = f"📝{cute_item}-{customer_name}-{partner_name}"
        
        # 檢查頻道是否已存在
        existing_channel = discord.utils.get(guild.text_channels, name=channel_name)
        if existing_channel:
            print(f"⚠️ 文字頻道已存在: {channel_name}")
            return existing_channel
        
        # 創建頻道
        channel = guild.create_text_channel(
            channel_name,
            category=None,  # 不指定分類
            topic=f"預約頻道 - 客戶: {customer_name}, 夥伴: {partner_name}"
        )
        print(f"✅ 創建文字頻道: {channel_name}")
        return channel
        
    except Exception as e:
        print(f"❌ 創建文字頻道失敗: {e}")
        return None

def create_booking_voice_channel(guild, booking_id, customer_name, partner_name):
    """創建預約語音頻道"""
    try:
        # 使用相同的 MD5 雜湊確保一致性
        hash_obj = hashlib.md5(booking_id.encode())
        hash_hex = hash_obj.hexdigest()
        cute_item = CUTE_ITEMS[int(hash_hex[:2], 16) % len(CUTE_ITEMS)]
        
        channel_name = f"🎤{cute_item}-{customer_name}-{partner_name}"
        
        # 檢查頻道是否已存在
        existing_channel = discord.utils.get(guild.voice_channels, name=channel_name)
        if existing_channel:
            print(f"⚠️ 語音頻道已存在: {channel_name}")
            return existing_channel
        
        # 創建頻道
        channel = guild.create_voice_channel(
            channel_name,
            category=None,  # 不指定分類
            bitrate=64000  # 設置音質
        )
        print(f"✅ 創建語音頻道: {channel_name}")
        return channel
        
    except Exception as e:
        print(f"❌ 創建語音頻道失敗: {e}")
        return None

# 檢查資料庫連線健康的函數
@tasks.loop(minutes=5)
async def database_health_check():
    """定期檢查資料庫連線健康狀態"""
    try:
        session = Session()
        session.execute(text("SELECT 1"))
        session.close()
        print("✅ 資料庫連線正常")
    except Exception as e:
        print(f"❌ 資料庫連線異常: {e}")
        # 嘗試重新初始化引擎
        try:
            global engine
            engine.dispose()
            engine = create_engine(DATABASE_URL)
            print("✅ 資料庫引擎重新初始化成功")
        except Exception as e2:
            print(f"❌ 資料庫引擎重新初始化失敗: {e2}")

# 計算推薦獎勵的函數
async def calculate_referral_earnings(booking_id):
    """計算推薦獎勵"""
    try:
        response = requests.post('https://peiplay.vercel.app/api/partners/referral/calculate-earnings', 
                               json={'bookingId': booking_id})
        if response.status_code == 200:
            print(f"✅ 推薦獎勵計算成功: {booking_id}")
                else:
            print(f"⚠️ 推薦獎勵計算失敗: {booking_id}, 狀態碼: {response.status_code}")
    except Exception as e:
        print(f"❌ 推薦獎勵計算錯誤: {e}")

# 檢查待審核項目的函數
@tasks.loop(hours=6)
async def check_pending_reviews():
    """檢查待審核的夥伴申請和提領申請"""
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
        if not admin_channel:
            print("❌ 找不到管理員頻道")
            return
        
        session = Session()
        
        # 檢查待審核的夥伴申請
        pending_partners = session.execute(text("""
            SELECT COUNT(*) as count FROM "Partner" 
            WHERE status = 'PENDING'
        """)).fetchone()
        
        # 檢查待審核的提領申請
        pending_withdrawals = session.execute(text("""
            SELECT COUNT(*) as count FROM "WithdrawalRequest" 
            WHERE status = 'PENDING'
        """)).fetchone()
        
        session.close()
        
        # 如果有待審核項目，發送通知
        if pending_partners.count > 0 or pending_withdrawals.count > 0:
            message = "🔔 **管理員通知**\n\n"
            if pending_partners.count > 0:
                message += f"📋 待審核夥伴申請: {pending_partners.count} 件\n"
            if pending_withdrawals.count > 0:
                message += f"💰 待審核提領申請: {pending_withdrawals.count} 件\n"
            message += "\n請及時處理待審核項目。"
            
            await admin_channel.send(message)
            print(f"✅ 發送待審核通知: 夥伴 {pending_partners.count} 件, 提領 {pending_withdrawals.count} 件")
        
    except Exception as e:
        print(f"❌ 檢查待審核項目時發生錯誤: {e}")

# 新的預約流程檢查函數
async def check_early_communication_channels(guild, now):
    """檢查需要創建提前溝通文字頻道的預約（預約確認後）"""
    try:
        session = Session()
        
        # 查找已確認但還沒有提前溝通頻道的預約
        bookings = session.execute(text("""
            SELECT b.id, b.customerId, b.scheduleId, b.discordEarlyTextChannelId,
                   c.name as customer_name, p.name as partner_name, b.isInstantBooking
            FROM "Booking" b
            JOIN "Customer" c ON b.customerId = c.id
            JOIN "Schedule" s ON b.scheduleId = s.id
            JOIN "Partner" p ON s.partnerId = p.id
            WHERE b.status = 'CONFIRMED' 
            AND b.discordEarlyTextChannelId IS NULL
            AND b.createdAt <= :now
        """), {'now': now}).fetchall()
        
        session.close()
        
        for booking in bookings:
            try:
                # 創建提前溝通文字頻道
                channel = create_booking_text_channel(
                    guild, 
                    booking.id, 
                    booking.customer_name, 
                    booking.partner_name,
                    booking.isInstantBooking
                )
                
                if channel:
                    # 更新資料庫
                    session = Session()
                    session.execute(text("""
                        UPDATE "Booking" 
                        SET "discordEarlyTextChannelId" = :channel_id
                        WHERE id = :booking_id
                    """), {'channel_id': str(channel.id), 'booking_id': booking.id})
                    session.commit()
                    session.close()
                    
                    # 發送歡迎訊息
                            embed = discord.Embed(
                        title="🎮 預約確認",
                        description=f"嗨 {booking.customer_name}！你的預約已確認，夥伴 {booking.partner_name} 將在預約時間與你聯繫。",
                        color=0x00ff00
                    )
                    embed.add_field(name="📅 預約時間", value="請等待夥伴確認具體時間", inline=False)
                    embed.add_field(name="💬 溝通方式", value="此頻道用於預約前的溝通", inline=False)
                    
                    await channel.send(embed=embed)
                    print(f"✅ 創建提前溝通頻道: {booking.id}")
                
                except Exception as e:
                print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
        
    except Exception as e:
        print(f"❌ 檢查提前溝通頻道時發生錯誤: {e}")

async def check_voice_channel_creation(guild, now):
    """檢查需要創建語音頻道的預約（開始前5分鐘）"""
    try:
        session = Session()
        
        # 查找需要創建語音頻道的預約（開始前5分鐘，且有提前溝通頻道但沒有語音頻道）
        five_minutes_later = now + timedelta(minutes=5)
        bookings = session.execute(text("""
            SELECT b.id, b.customerId, b.scheduleId, b.discordEarlyTextChannelId, b.discordTextChannelId, b.discordVoiceChannelId,
                   c.name as customer_name, p.name as partner_name, s.startTime, b.isInstantBooking
            FROM "Booking" b
            JOIN "Customer" c ON b.customerId = c.id
            JOIN "Schedule" s ON b.scheduleId = s.id
            JOIN "Partner" p ON s.partnerId = p.id
            WHERE b.status = 'CONFIRMED'
            AND b.discordEarlyTextChannelId IS NOT NULL
            AND b.discordVoiceChannelId IS NULL
            AND s.startTime <= :five_minutes_later
            AND s.startTime > :now
        """), {'five_minutes_later': five_minutes_later, 'now': now}).fetchall()
        
        session.close()
        
        for booking in bookings:
            try:
                # 創建語音頻道
                voice_channel = create_booking_voice_channel(
                    guild, 
                    booking.id, 
                    booking.customer_name, 
                    booking.partner_name
                )
                
                if voice_channel:
                    # 創建正式文字頻道
                    text_channel = create_booking_text_channel(
                        guild, 
                        booking.id, 
                        booking.customer_name, 
                        booking.partner_name
                    )
                    
                if text_channel:
                        # 更新資料庫
                        session = Session()
                        session.execute(text("""
                            UPDATE "Booking" 
                            SET "discordVoiceChannelId" = :voice_id, "discordTextChannelId" = :text_id
                            WHERE id = :booking_id
                        """), {
                            'voice_id': str(voice_channel.id), 
                            'text_id': str(text_channel.id),
                            'booking_id': booking.id
                        })
                        session.commit()
                        session.close()
                        
                        # 刪除提前溝通頻道
                        try:
                            early_channel = guild.get_channel(int(booking.discordEarlyTextChannelId))
                            if early_channel:
                                await early_channel.delete()
                                print(f"✅ 刪除提前溝通頻道: {booking.id}")
                        except Exception as e:
                            print(f"⚠️ 刪除提前溝通頻道失敗: {e}")
                        
                        # 在正式文字頻道發送歡迎訊息
                        embed = discord.Embed(
                            title="🎮 預約開始",
                            description=f"預約即將開始！請進入語音頻道開始遊戲。",
                            color=0x0099ff
                        )
                        embed.add_field(name="🎤 語音頻道", value=f"請點擊 {voice_channel.mention} 進入", inline=False)
                        embed.add_field(name="⏰ 開始時間", value=f"<t:{int(booking.startTime.timestamp())}:R>", inline=False)
                        
                        await text_channel.send(embed=embed)
                        print(f"✅ 創建正式頻道: {booking.id}")
                
            except Exception as e:
                print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
        
    except Exception as e:
        print(f"❌ 檢查語音頻道創建時發生錯誤: {e}")

async def check_extension_buttons(guild, now):
    """檢查需要顯示延長按鈕的預約（結束前10分鐘）"""
    try:
        session = Session()
        
        # 查找需要顯示延長按鈕的預約（結束前10分鐘，且還沒有顯示過）
        ten_minutes_later = now + timedelta(minutes=10)
        bookings = session.execute(text("""
            SELECT b.id, b.discordTextChannelId, s.endTime
                FROM "Booking" b
            JOIN "Schedule" s ON b.scheduleId = s.id
                WHERE b.status = 'CONFIRMED'
            AND b.discordTextChannelId IS NOT NULL
            AND b.extensionButtonShown = false
            AND s.endTime <= :ten_minutes_later
            AND s.endTime > :now
        """), {'ten_minutes_later': ten_minutes_later, 'now': now}).fetchall()
        
        session.close()
        
        for booking in bookings:
            try:
                text_channel = guild.get_channel(int(booking.discordTextChannelId))
                if text_channel:
                    # 發送延長按鈕
                    embed = discord.Embed(
                        title="⏰ 預約即將結束",
                        description="預約還有 10 分鐘結束，是否需要延長 5 分鐘？",
                        color=0xff9900
                    )
                    
                    view = discord.ui.View()
                    extend_button = discord.ui.Button(
                        label="延長 5 分鐘",
                        style=discord.ButtonStyle.primary,
                        custom_id=f"extend_booking_{booking.id}"
                    )
                    view.add_item(extend_button)
                    
                    await text_channel.send(embed=embed, view=view)
                    
                    # 更新資料庫
                    session = Session()
                    session.execute(text("""
                        UPDATE "Booking" 
                        SET "extensionButtonShown" = true
                        WHERE id = :booking_id
                    """), {'booking_id': booking.id})
                    session.commit()
                    session.close()
                    
                    print(f"✅ 顯示延長按鈕: {booking.id}")
                        
                except Exception as e:
                print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
                    
    except Exception as e:
        print(f"❌ 檢查延長按鈕時發生錯誤: {e}")

async def check_voice_channel_cleanup(guild, now):
    """檢查需要結束語音頻道的預約（時間結束）"""
    try:
        session = Session()
        
        # 查找需要結束語音頻道的預約
        bookings = session.execute(text("""
            SELECT b.id, b.discordVoiceChannelId, b.discordTextChannelId, b.ratingCompleted,
                   c.name as customer_name, p.name as partner_name, s.endTime
        FROM "Booking" b
            JOIN "Customer" c ON b.customerId = c.id
            JOIN "Schedule" s ON b.scheduleId = s.id
            JOIN "Partner" p ON s.partnerId = p.id
            WHERE b.status = 'CONFIRMED'
            AND b.discordVoiceChannelId IS NOT NULL
            AND s.endTime <= :now
        """), {'now': now}).fetchall()
        
        session.close()
        
        for booking in bookings:
            try:
                # 刪除語音頻道
                voice_channel = guild.get_channel(int(booking.discordVoiceChannelId))
                if voice_channel and not voice_channel.deleted:
                            await voice_channel.delete()
                    print(f"✅ 刪除語音頻道: {booking.id}")
                
                # 在文字頻道顯示評價系統
                text_channel = guild.get_channel(int(booking.discordTextChannelId))
                if text_channel and not booking.ratingCompleted:
                    embed = discord.Embed(
                        title="⭐ 預約結束",
                        description=f"預約已結束，請為夥伴 {booking.partner_name} 評分。\n點選下方按鈕選擇 1-5 顆星評價：",
                        color=0x9932cc
                    )
                    
                    view = discord.ui.View()
                    for i in range(1, 6):
                        # 根據星級數量顯示不同數量的星號
                        stars = "⭐" * i
                        button = discord.ui.Button(
                            label=f"{i} 顆星 {stars}",
                            style=discord.ButtonStyle.secondary,
                            custom_id=f"rate_{booking.id}_{i}"
                        )
                        view.add_item(button)
                    
                    await text_channel.send(embed=embed, view=view)
                    print(f"✅ 顯示評價系統: {booking.id}")
                
            except Exception as e:
                print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
        
    except Exception as e:
        print(f"❌ 檢查語音頻道清理時發生錯誤: {e}")

async def check_text_channel_cleanup(guild, now):
    """檢查需要清理文字頻道的預約（評價完成後）"""
    try:
        session = Session()
        
        # 查找需要清理文字頻道的預約（評價完成且文字頻道未清理）
        bookings = session.execute(text("""
            SELECT b.id, b.discordTextChannelId, b.ratingCompleted, b.textChannelCleaned
        FROM "Booking" b
            WHERE b.ratingCompleted = true
            AND b.textChannelCleaned = false
            AND b.discordTextChannelId IS NOT NULL
        """)).fetchall()
        
        session.close()
        
        for booking in bookings:
            try:
                # 刪除文字頻道
                text_channel = guild.get_channel(int(booking.discordTextChannelId))
                if text_channel and not text_channel.deleted:
                    await text_channel.delete()
                    print(f"✅ 刪除文字頻道: {booking.id}")
                
                # 更新資料庫
                session = Session()
                session.execute(text("""
                    UPDATE "Booking" 
                    SET "textChannelCleaned" = true
                    WHERE id = :booking_id
                """), {'booking_id': booking.id})
                session.commit()
                session.close()
                
                        except Exception as e:
                print(f"❌ 處理預約 {booking.id} 時發生錯誤: {e}")
                
    except Exception as e:
        print(f"❌ 檢查文字頻道清理時發生錯誤: {e}")

# 主要的預約檢查任務
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_bookings():
    """定期檢查預約狀態並管理 Discord 頻道"""
    await bot.wait_until_ready()

    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        now = datetime.now(timezone.utc)
        
        # 1. 檢查需要創建提前溝通文字頻道的預約（預約確認後）
        await check_early_communication_channels(guild, now)
        
        # 2. 檢查需要創建語音頻道的預約（開始前5分鐘）
        await check_voice_channel_creation(guild, now)
        
        # 3. 檢查需要顯示延長按鈕的預約（結束前10分鐘）
        await check_extension_buttons(guild, now)
        
        # 4. 檢查需要結束語音頻道的預約（時間結束）
        await check_voice_channel_cleanup(guild, now)
        
        # 5. 檢查需要清理文字頻道的預約（評價完成後）
        await check_text_channel_cleanup(guild, now)
        
    except Exception as e:
        print(f"❌ 檢查預約時發生錯誤: {e}")

# 檢查新預約的任務
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_new_bookings():
    """檢查新的預約並創建 Discord 頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        session = Session()
        
        # 查找已確認但還沒有 Discord 頻道的新預約
        new_bookings = session.execute(text("""
            SELECT b.id, b.customerId, b.scheduleId, b.isInstantBooking, b.discordDelayMinutes,
                   c.name as customer_name, p.name as partner_name, s.startTime
            FROM "Booking" b
            JOIN "Customer" c ON b.customerId = c.id
            JOIN "Schedule" s ON b.scheduleId = s.id
            JOIN "Partner" p ON s.partnerId = p.id
            WHERE b.status = 'CONFIRMED' 
            AND b.discordEarlyTextChannelId IS NULL
            AND b.createdAt <= NOW() - INTERVAL '3 minutes'
        """)).fetchall()
        
        session.close()
        
        for booking in new_bookings:
            try:
                # 創建提前溝通文字頻道
                channel = create_booking_text_channel(
                    guild, 
                    booking.id, 
                    booking.customer_name, 
                    booking.partner_name,
                    booking.isInstantBooking
                )
                
                if channel:
                    # 更新資料庫
                    session = Session()
                    session.execute(text("""
                        UPDATE "Booking" 
                        SET "discordEarlyTextChannelId" = :channel_id
                        WHERE id = :booking_id
                    """), {'channel_id': str(channel.id), 'booking_id': booking.id})
                    session.commit()
                    session.close()
                    
                    # 發送歡迎訊息
                    embed = discord.Embed(
                        title="🎮 預約確認",
                        description=f"嗨 {booking.customer_name}！你的預約已確認，夥伴 {booking.partner_name} 將在預約時間與你聯繫。",
                        color=0x00ff00
                    )
                    embed.add_field(name="📅 預約時間", value="請等待夥伴確認具體時間", inline=False)
                    embed.add_field(name="💬 溝通方式", value="此頻道用於預約前的溝通", inline=False)
                    
                    await channel.send(embed=embed)
                    print(f"✅ 創建新預約頻道: {booking.id}")
                
            except Exception as e:
                print(f"❌ 處理新預約 {booking.id} 時發生錯誤: {e}")
                
    except Exception as e:
        print(f"❌ 檢查新預約時發生錯誤: {e}")

# 檢查即時預約的任務
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_instant_bookings_for_voice_channel():
    """檢查即時預約是否需要創建語音頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        session = Session()
        
        # 查找即時預約中需要創建語音頻道的
        now = datetime.now(timezone.utc)
        instant_bookings = session.execute(text("""
            SELECT b.id, b.customerId, b.scheduleId, b.discordEarlyTextChannelId, b.discordVoiceChannelId,
                   c.name as customer_name, p.name as partner_name, s.startTime
            FROM "Booking" b
            JOIN "Customer" c ON b.customerId = c.id
            JOIN "Schedule" s ON b.scheduleId = s.id
            JOIN "Partner" p ON s.partnerId = p.id
            WHERE b.status = 'CONFIRMED' 
            AND b.isInstantBooking = true
            AND b.discordEarlyTextChannelId IS NOT NULL
            AND b.discordVoiceChannelId IS NULL
            AND s.startTime <= :now
        """), {'now': now}).fetchall()
        
        session.close()
        
        for booking in instant_bookings:
            try:
                # 創建語音頻道
                voice_channel = create_booking_voice_channel(
                    guild, 
                    booking.id, 
                    booking.customer_name, 
                    booking.partner_name
                )
                
                if voice_channel:
                    # 創建正式文字頻道
                    text_channel = create_booking_text_channel(
                        guild, 
                        booking.id, 
                        booking.customer_name, 
                        booking.partner_name
                    )
                    
                    if text_channel:
                        # 更新資料庫
                        session = Session()
                        session.execute(text("""
                            UPDATE "Booking" 
                            SET "discordVoiceChannelId" = :voice_id, "discordTextChannelId" = :text_id
                            WHERE id = :booking_id
                        """), {
                            'voice_id': str(voice_channel.id), 
                            'text_id': str(text_channel.id),
                            'booking_id': booking.id
                        })
                        session.commit()
                        session.close()
                        
                        # 刪除提前溝通頻道
                        try:
                            early_channel = guild.get_channel(int(booking.discordEarlyTextChannelId))
                            if early_channel:
                                await early_channel.delete()
                                print(f"✅ 刪除即時預約提前溝通頻道: {booking.id}")
                    except Exception as e:
                            print(f"⚠️ 刪除即時預約提前溝通頻道失敗: {e}")
                        
                        # 在正式文字頻道發送歡迎訊息
                        embed = discord.Embed(
                            title="🎮 即時預約開始",
                            description=f"即時預約已開始！請進入語音頻道開始遊戲。",
                            color=0x0099ff
                        )
                        embed.add_field(name="🎤 語音頻道", value=f"請點擊 {voice_channel.mention} 進入", inline=False)
                        
                        await text_channel.send(embed=embed)
                        print(f"✅ 創建即時預約正式頻道: {booking.id}")
                
                    except Exception as e:
                print(f"❌ 處理即時預約 {booking.id} 時發生錯誤: {e}")
        
                    except Exception as e:
        print(f"❌ 檢查即時預約時發生錯誤: {e}")

# 檢查缺少評價的預約
@tasks.loop(minutes=5)
async def check_missing_ratings():
    """檢查缺少評價的預約並更新狀態"""
    try:
        session = Session()
        
        # 查找已結束但缺少評價的預約
        missing_ratings = session.execute(text("""
            SELECT b.id, s.endTime
            FROM "Booking" b
            JOIN "Schedule" s ON b.scheduleId = s.id
            WHERE b.status = 'CONFIRMED'
            AND s.endTime < NOW() - INTERVAL '1 hour'
            AND NOT EXISTS (
                SELECT 1 FROM "Review" r WHERE r.bookingId = b.id
            )
        """)).fetchall()
        
        # 更新預約狀態為已完成
        for booking in missing_ratings:
            session.execute(text("""
                UPDATE "Booking" 
                SET status = 'COMPLETED'
                WHERE id = :booking_id
            """), {'booking_id': booking.id})
            
            # 計算推薦獎勵
            await calculate_referral_earnings(booking.id)
        
        session.commit()
        session.close()
        
        if missing_ratings:
            print(f"✅ 更新了 {len(missing_ratings)} 個缺少評價的預約狀態")
        
    except Exception as e:
        print(f"❌ 檢查缺少評價時發生錯誤: {e}")

# Bot 事件處理
@bot.event
async def on_ready():
    print(f'✅ {bot.user} 已上線！')
    print(f'📊 伺服器數量: {len(bot.guilds)}')
    
    # 同步 Slash 指令
    try:
        synced = await bot.tree.sync()
        print(f'✅ 已同步 {len(synced)} 個 Slash 指令')
                                        except Exception as e:
        print(f'❌ 同步 Slash 指令失敗: {e}')
    
    # 啟動檢查任務
    if not check_bookings.is_running():
        check_bookings.start()
        print('✅ 啟動預約檢查任務')
    
    if not check_new_bookings.is_running():
        check_new_bookings.start()
        print('✅ 啟動新預約檢查任務')
    
    if not check_instant_bookings_for_voice_channel.is_running():
        check_instant_bookings_for_voice_channel.start()
        print('✅ 啟動即時預約檢查任務')
    
    if not check_missing_ratings.is_running():
        check_missing_ratings.start()
        print('✅ 啟動缺少評價檢查任務')
    
    if not database_health_check.is_running():
        database_health_check.start()
        print('✅ 啟動資料庫健康檢查任務')
    
    if not check_pending_reviews.is_running():
        check_pending_reviews.start()
        print('✅ 啟動待審核檢查任務')

@bot.event
async def on_interaction(interaction):
    """處理所有互動事件"""
    if not interaction.is_component():
        return
    
    custom_id = interaction.custom_id
    
    try:
        if custom_id.startswith('rate_'):
            # 處理評價按鈕
            parts = custom_id.split('_')
            if len(parts) >= 3:
                booking_id = parts[1]
                rating = int(parts[2])
                
                await handle_rating(interaction, booking_id, rating)
        
        elif custom_id.startswith('extend_booking_'):
            # 處理延長預約按鈕
            booking_id = custom_id.replace('extend_booking_', '')
            await handle_extend_booking(interaction, booking_id)
                    
                except Exception as e:
        print(f"❌ 處理互動時發生錯誤: {e}")
        if not interaction.response.is_done():
            await interaction.response.send_message("❌ 處理請求時發生錯誤，請稍後再試。", ephemeral=True)

async def handle_rating(interaction, booking_id, rating):
    """處理評價"""
    try:
        # 更新資料庫中的評價
        session = Session()
        
        # 檢查是否已經評價過
        existing_review = session.execute(text("""
            SELECT id FROM "Review" WHERE bookingId = :booking_id
        """), {'booking_id': booking_id}).fetchone()
        
        if existing_review:
            await interaction.response.send_message("❌ 此預約已經評價過了。", ephemeral=True)
            session.close()
            return
        
        # 獲取預約信息
        booking_info = session.execute(text("""
            SELECT b.customerId, b.scheduleId, s.partnerId
            FROM "Booking" b
            JOIN "Schedule" s ON b.scheduleId = s.id
            WHERE b.id = :booking_id
        """), {'booking_id': booking_id}).fetchone()
        
        if not booking_info:
            await interaction.response.send_message("❌ 找不到預約信息。", ephemeral=True)
            session.close()
            return
        
        # 創建評價記錄
        session.execute(text("""
            INSERT INTO "Review" (id, bookingId, reviewerId, revieweeId, rating, comment, createdAt)
            VALUES (:id, :booking_id, :reviewer_id, :reviewee_id, :rating, :comment, :created_at)
        """), {
            'id': f"review_{booking_id}_{int(time.time())}",
            'booking_id': booking_id,
            'reviewer_id': booking_info.customerId,
            'reviewee_id': booking_info.partnerId,
            'rating': rating,
            'comment': f"自動評價：{rating}星",
            'created_at': datetime.now(timezone.utc)
        })
        
        # 更新預約狀態
        session.execute(text("""
            UPDATE "Booking" 
            SET "ratingCompleted" = true, status = 'COMPLETED'
            WHERE id = :booking_id
        """), {'booking_id': booking_id})
        
        session.commit()
        session.close()
        
        # 發送確認訊息
        stars_display = "⭐" * rating
        embed = discord.Embed(
            title="⭐ 評價完成",
            description=f"感謝你的評價！你給予了 {rating} 顆星評價。",
            color=0x00ff00
        )
        embed.add_field(name="你的評價", value=f"{rating} 顆星 {stars_display}", inline=False)
        embed.add_field(name="評價說明", value="你的評價將幫助其他用戶選擇合適的遊戲夥伴", inline=False)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
        # 通知管理員頻道
        try:
            guild = bot.get_guild(GUILD_ID)
            admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
            if admin_channel:
                stars_display = "⭐" * rating
                admin_embed = discord.Embed(
                    title="📊 新評價",
                    description=f"預約 {booking_id} 收到新評價",
                    color=0x0099ff
                )
                admin_embed.add_field(name="評價星級", value=f"{rating} 顆星 {stars_display}", inline=True)
                admin_embed.add_field(name="評價時間", value=f"<t:{int(datetime.now(timezone.utc).timestamp())}:F>", inline=True)
                await admin_channel.send(embed=admin_embed)
        except Exception as e:
            print(f"⚠️ 發送管理員通知失敗: {e}")
        
        print(f"✅ 處理評價: {booking_id}, {rating}星")
        
    except Exception as e:
        print(f"❌ 處理評價時發生錯誤: {e}")
        if not interaction.response.is_done():
            await interaction.response.send_message("❌ 評價失敗，請稍後再試。", ephemeral=True)

async def handle_extend_booking(interaction, booking_id):
    """處理延長預約"""
    try:
        # 更新資料庫中的預約時間
        session = Session()
        
        # 獲取當前結束時間
        current_end_time = session.execute(text("""
            SELECT s.endTime FROM "Booking" b
            JOIN "Schedule" s ON b.scheduleId = s.id
            WHERE b.id = :booking_id
        """), {'booking_id': booking_id}).fetchone()
        
        if not current_end_time:
            await interaction.response.send_message("❌ 找不到預約信息。", ephemeral=True)
            session.close()
            return
        
                # 延長5分鐘
        new_end_time = current_end_time.endTime + timedelta(minutes=5)
        
        # 更新結束時間
        session.execute(text("""
                    UPDATE "Schedule" 
            SET "endTime" = :new_end_time
                    WHERE id = (
                SELECT scheduleId FROM "Booking" WHERE id = :booking_id
            )
        """), {'new_end_time': new_end_time, 'booking_id': booking_id})
        
        session.commit()
        session.close()
            
            # 發送確認訊息
        embed = discord.Embed(
            title="⏰ 預約已延長",
            description=f"預約已延長 5 分鐘，新的結束時間是 <t:{int(new_end_time.timestamp())}:F>",
            color=0x00ff00
        )
        
        await interaction.response.send_message(embed=embed)
        
        print(f"✅ 延長預約: {booking_id}, 新結束時間: {new_end_time}")
            
        except Exception as e:
        print(f"❌ 延長預約時發生錯誤: {e}")
        if not interaction.response.is_done():
            await interaction.response.send_message("❌ 延長預約失敗，請稍後再試。", ephemeral=True)

# Slash 指令
@bot.tree.command(name="ping", description="檢查 Bot 延遲")
async def ping(interaction: discord.Interaction):
    """檢查 Bot 延遲"""
    latency = round(bot.latency * 1000)
    embed = discord.Embed(
        title="🏓 Pong!",
        description=f"延遲: {latency}ms",
        color=0x00ff00
    )
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="status", description="檢查 Bot 狀態")
async def status(interaction: discord.Interaction):
    """檢查 Bot 狀態"""
    try:
        # 檢查資料庫連線
        session = Session()
        session.execute(text("SELECT 1"))
        db_status = "✅ 正常"
        session.close()
    except:
        db_status = "❌ 異常"
    
    # 檢查任務狀態
    tasks_status = []
    if check_bookings.is_running():
        tasks_status.append("✅ 預約檢查")
    else:
        tasks_status.append("❌ 預約檢查")
    
    if check_new_bookings.is_running():
        tasks_status.append("✅ 新預約檢查")
                    else:
        tasks_status.append("❌ 新預約檢查")
    
    if database_health_check.is_running():
        tasks_status.append("✅ 資料庫健康檢查")
    else:
        tasks_status.append("❌ 資料庫健康檢查")
    
    embed = discord.Embed(
        title="📊 Bot 狀態",
        color=0x0099ff
    )
    embed.add_field(name="資料庫連線", value=db_status, inline=False)
    embed.add_field(name="任務狀態", value="\n".join(tasks_status), inline=False)
    embed.add_field(name="伺服器數量", value=str(len(bot.guilds)), inline=True)
    embed.add_field(name="延遲", value=f"{round(bot.latency * 1000)}ms", inline=True)
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="cleanup", description="清理孤立的 Discord 頻道")
async def cleanup(interaction: discord.Interaction):
    """清理孤立的 Discord 頻道"""
    if not interaction.user.id == ADMIN_USER_ID:
        await interaction.response.send_message("❌ 只有管理員可以使用此指令。", ephemeral=True)
            return
    
    await interaction.response.defer(ephemeral=True)
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            await interaction.followup.send("❌ 找不到 Discord 伺服器")
            return
        
        # 獲取所有預約頻道
        session = Session()
        all_channels = session.execute(text("""
            SELECT "discordEarlyTextChannelId", "discordTextChannelId", "discordVoiceChannelId"
            FROM "Booking"
            WHERE "discordEarlyTextChannelId" IS NOT NULL 
            OR "discordTextChannelId" IS NOT NULL 
            OR "discordVoiceChannelId" IS NOT NULL
        """)).fetchall()
        session.close()
        
        # 收集所有有效的頻道 ID
        valid_channel_ids = set()
        for channel in all_channels:
            if channel.discordEarlyTextChannelId:
                valid_channel_ids.add(int(channel.discordEarlyTextChannelId))
            if channel.discordTextChannelId:
                valid_channel_ids.add(int(channel.discordTextChannelId))
            if channel.discordVoiceChannelId:
                valid_channel_ids.add(int(channel.discordVoiceChannelId))
        
        # 檢查所有頻道
            deleted_count = 0
        for channel in guild.channels:
            # 檢查是否是預約頻道（包含特殊字符）
            if any(char in channel.name for char in ['📝', '🎤', '🔥']):
                if channel.id not in valid_channel_ids:
                try:
                    await channel.delete()
                    deleted_count += 1
                        print(f"✅ 刪除孤立頻道: {channel.name}")
                except Exception as e:
                    print(f"❌ 刪除頻道失敗 {channel.name}: {e}")
            
        embed = discord.Embed(
            title="🧹 清理完成",
            description=f"已刪除 {deleted_count} 個孤立的頻道",
            color=0x00ff00
        )
        await interaction.followup.send(embed=embed)
            
    except Exception as e:
        print(f"❌ 清理頻道時發生錯誤: {e}")
        await interaction.followup.send("❌ 清理失敗，請稍後再試。")

@bot.tree.command(name="force_cleanup", description="強制清理所有預約頻道")
async def force_cleanup(interaction: discord.Interaction):
    """強制清理所有預約頻道"""
    if not interaction.user.id == ADMIN_USER_ID:
        await interaction.response.send_message("❌ 只有管理員可以使用此指令。", ephemeral=True)
        return
    
    await interaction.response.defer(ephemeral=True)
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            await interaction.followup.send("❌ 找不到 Discord 伺服器")
                return
                
        deleted_count = 0
        for channel in guild.channels:
            # 檢查是否是預約頻道
            if any(char in channel.name for char in ['📝', '🎤', '🔥']):
                try:
                    await channel.delete()
                    deleted_count += 1
                    print(f"✅ 強制刪除頻道: {channel.name}")
        except Exception as e:
                    print(f"❌ 強制刪除頻道失敗 {channel.name}: {e}")
        
        embed = discord.Embed(
            title="🧹 強制清理完成",
            description=f"已刪除 {deleted_count} 個預約頻道",
            color=0xff0000
        )
        await interaction.followup.send(embed=embed)
        
        except Exception as e:
        print(f"❌ 強制清理頻道時發生錯誤: {e}")
        await interaction.followup.send("❌ 強制清理失敗，請稍後再試。")

@bot.tree.command(name="emergency_cleanup", description="緊急清理所有頻道")
async def emergency_cleanup(interaction: discord.Interaction):
    """緊急清理所有頻道"""
    if not interaction.user.id == ADMIN_USER_ID:
        await interaction.response.send_message("❌ 只有管理員可以使用此指令。", ephemeral=True)
        return
    
    await interaction.response.defer(ephemeral=True)
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            await interaction.followup.send("❌ 找不到 Discord 伺服器")
            return
        
        deleted_count = 0
        for channel in guild.channels:
            # 刪除所有非系統頻道
            if channel.type in [discord.ChannelType.text, discord.ChannelType.voice]:
                try:
                    await channel.delete()
                    deleted_count += 1
                    print(f"✅ 緊急刪除頻道: {channel.name}")
        except Exception as e:
                    print(f"❌ 緊急刪除頻道失敗 {channel.name}: {e}")
        
        embed = discord.Embed(
            title="🚨 緊急清理完成",
            description=f"已刪除 {deleted_count} 個頻道",
            color=0xff0000
        )
        await interaction.followup.send(embed=embed)
        
        except Exception as e:
        print(f"❌ 緊急清理頻道時發生錯誤: {e}")
        await interaction.followup.send("❌ 緊急清理失敗，請稍後再試。")

@bot.tree.command(name="stats", description="顯示預約統計")
async def stats(interaction: discord.Interaction):
    """顯示預約統計"""
    if not interaction.user.id == ADMIN_USER_ID:
        await interaction.response.send_message("❌ 只有管理員可以使用此指令。", ephemeral=True)
        return
    
    await interaction.response.defer(ephemeral=True)
    
    try:
        session = Session()
        
        # 獲取統計數據
        total_bookings = session.execute(text("SELECT COUNT(*) FROM \"Booking\"")).fetchone()[0]
        confirmed_bookings = session.execute(text("SELECT COUNT(*) FROM \"Booking\" WHERE status = 'CONFIRMED'")).fetchone()[0]
        completed_bookings = session.execute(text("SELECT COUNT(*) FROM \"Booking\" WHERE status = 'COMPLETED'")).fetchone()[0]
        
        # 獲取今天的預約
        today = datetime.now(timezone.utc).date()
        today_bookings = session.execute(text("""
            SELECT COUNT(*) FROM "Booking" b
            JOIN "Schedule" s ON b.scheduleId = s.id
            WHERE DATE(s.startTime) = :today
        """), {'today': today}).fetchone()[0]
        
        # 獲取活躍頻道
        active_channels = session.execute(text("""
            SELECT COUNT(*) FROM "Booking"
            WHERE "discordEarlyTextChannelId" IS NOT NULL
            OR "discordTextChannelId" IS NOT NULL
            OR "discordVoiceChannelId" IS NOT NULL
        """)).fetchone()[0]
        
        session.close()
        
            embed = discord.Embed(
            title="📊 預約統計",
            color=0x0099ff
        )
        embed.add_field(name="總預約數", value=str(total_bookings), inline=True)
        embed.add_field(name="已確認預約", value=str(confirmed_bookings), inline=True)
        embed.add_field(name="已完成預約", value=str(completed_bookings), inline=True)
        embed.add_field(name="今日預約", value=str(today_bookings), inline=True)
        embed.add_field(name="活躍頻道", value=str(active_channels), inline=True)
        embed.add_field(name="檢查間隔", value=f"{CHECK_INTERVAL}秒", inline=True)
        
        await interaction.followup.send(embed=embed)
            
        except Exception as e:
        print(f"❌ 獲取統計數據時發生錯誤: {e}")
        await interaction.followup.send("❌ 獲取統計數據失敗，請稍後再試。")

@bot.tree.command(name="test_notification", description="測試管理員通知")
async def test_notification(interaction: discord.Interaction):
    """測試管理員通知"""
    if not interaction.user.id == ADMIN_USER_ID:
        await interaction.response.send_message("❌ 只有管理員可以使用此指令。", ephemeral=True)
                    return
    
    try:
        guild = bot.get_guild(GUILD_ID)
        admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
        
        if admin_channel:
            embed = discord.Embed(
                title="🧪 測試通知",
                description="這是一個測試通知，用於確認管理員頻道正常工作。",
                color=0x0099ff
            )
            await admin_channel.send(embed=embed)
            await interaction.response.send_message("✅ 測試通知已發送", ephemeral=True)
                else:
            await interaction.response.send_message("❌ 找不到管理員頻道", ephemeral=True)
            
    except Exception as e:
        print(f"❌ 發送測試通知時發生錯誤: {e}")
        await interaction.response.send_message("❌ 發送測試通知失敗", ephemeral=True)

@bot.tree.command(name="debug_booking", description="調試特定預約")
async def debug_booking(interaction: discord.Interaction, booking_id: str):
    """調試特定預約"""
    if not interaction.user.id == ADMIN_USER_ID:
        await interaction.response.send_message("❌ 只有管理員可以使用此指令。", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)
    
    try:
        session = Session()
        
        # 獲取預約詳細信息
        booking_info = session.execute(text("""
            SELECT b.*, c.name as customer_name, p.name as partner_name, 
                   s.startTime, s.endTime, s.status as schedule_status
            FROM "Booking" b
            JOIN "Customer" c ON b.customerId = c.id
            JOIN "Schedule" s ON b.scheduleId = s.id
            JOIN "Partner" p ON s.partnerId = p.id
            WHERE b.id = :booking_id
        """), {'booking_id': booking_id}).fetchone()
        
        session.close()
        
        if not booking_info:
            await interaction.followup.send("❌ 找不到指定的預約")
            return
        
        # 創建調試信息嵌入
        embed = discord.Embed(
            title=f"🔍 預約調試: {booking_id}",
            color=0x0099ff
        )
        
        embed.add_field(name="客戶", value=booking_info.customer_name, inline=True)
        embed.add_field(name="夥伴", value=booking_info.partner_name, inline=True)
        embed.add_field(name="狀態", value=booking_info.status, inline=True)
        embed.add_field(name="開始時間", value=f"<t:{int(booking_info.startTime.timestamp())}:F>", inline=True)
        embed.add_field(name="結束時間", value=f"<t:{int(booking_info.endTime.timestamp())}:F>", inline=True)
        embed.add_field(name="時程狀態", value=booking_info.schedule_status, inline=True)
        
        # Discord 頻道信息
        discord_info = []
        if booking_info.discordEarlyTextChannelId:
            discord_info.append(f"提前文字: {booking_info.discordEarlyTextChannelId}")
        if booking_info.discordTextChannelId:
            discord_info.append(f"正式文字: {booking_info.discordTextChannelId}")
        if booking_info.discordVoiceChannelId:
            discord_info.append(f"語音: {booking_info.discordVoiceChannelId}")
        
        if discord_info:
            embed.add_field(name="Discord 頻道", value="\n".join(discord_info), inline=False)
        
        # 其他信息
        embed.add_field(name="即時預約", value="是" if booking_info.isInstantBooking else "否", inline=True)
        embed.add_field(name="延長按鈕", value="已顯示" if booking_info.extensionButtonShown else "未顯示", inline=True)
        embed.add_field(name="評價完成", value="是" if booking_info.ratingCompleted else "否", inline=True)
        
        await interaction.followup.send(embed=embed)
        
    except Exception as e:
        print(f"❌ 調試預約時發生錯誤: {e}")
        await interaction.followup.send("❌ 調試預約失敗，請稍後再試。")

# Flask API 設定
app = Flask(__name__)

@app.route('/create_instant_text_channel', methods=['POST'])
def create_instant_text_channel():
    """為即時預約創建文字頻道"""
    try:
    data = request.get_json()
        booking_id = data.get('booking_id')
        customer_name = data.get('customer_name')
        partner_name = data.get('partner_name')
        
        if not all([booking_id, customer_name, partner_name]):
            return jsonify({'error': '缺少必要參數'}), 400
        
        # 獲取 Discord 伺服器
            guild = bot.get_guild(GUILD_ID)
            if not guild:
            return jsonify({'error': '找不到 Discord 伺服器'}), 500
        
        # 創建文字頻道
        channel = create_booking_text_channel(guild, booking_id, customer_name, partner_name, True)
        
        if channel:
            # 更新資料庫
            session = Session()
            session.execute(text("""
                UPDATE "Booking" 
                SET "discordEarlyTextChannelId" = :channel_id
                WHERE id = :booking_id
            """), {'channel_id': str(channel.id), 'booking_id': booking_id})
            session.commit()
            session.close()
            
            return jsonify({
                'success': True,
                'channel_id': str(channel.id),
                'channel_name': channel.name
            })
                else:
            return jsonify({'error': '創建頻道失敗'}), 500
            
    except Exception as e:
        print(f"❌ 創建即時文字頻道時發生錯誤: {e}")
        return jsonify({'error': '創建頻道時發生錯誤'}), 500

@app.route('/invite_user', methods=['POST'])
def invite_user():
    """邀請用戶加入 Discord 伺服器"""
    try:
        data = request.get_json()
        discord_name = data.get('discord_name')
        user_name = data.get('user_name')
        user_email = data.get('user_email')
        
        if not discord_name:
            return jsonify({'error': '缺少 Discord 名稱'}), 400
        
        # 獲取 Discord 伺服器
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            return jsonify({'error': '找不到 Discord 伺服器'}), 500
        
        # 嘗試找到用戶
        member = None
        for m in guild.members:
            if m.display_name == discord_name or m.name == discord_name:
                member = m
                break
        
        if member:
            # 發送歡迎訊息
            embed = discord.Embed(
                title="🎉 歡迎加入 PeiPlay！",
                description=f"嗨 {user_name}！歡迎加入我們的 Discord 伺服器！",
                color=0x00ff00
            )
            embed.add_field(name="📧 註冊信箱", value=user_email, inline=False)
            embed.add_field(name="💡 使用提示", value="你可以在這裡找到遊戲夥伴，預約陪玩服務！", inline=False)
            
            try:
                await member.send(embed=embed)
                return jsonify({'success': True, 'message': '歡迎訊息已發送'})
            except:
                return jsonify({'success': True, 'message': '用戶已找到，但無法發送私訊'})
            else:
            # 通知管理員
            admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
            if admin_channel:
                embed = discord.Embed(
                    title="👤 新用戶註冊",
                    description=f"新用戶 {user_name} 註冊了 PeiPlay，但找不到 Discord 用戶 {discord_name}",
                    color=0xff9900
                )
                embed.add_field(name="📧 信箱", value=user_email, inline=False)
                embed.add_field(name="🎮 Discord 名稱", value=discord_name, inline=False)
                await admin_channel.send(embed=embed)
            
            return jsonify({'success': False, 'message': '找不到 Discord 用戶，已通知管理員'})
            
    except Exception as e:
        print(f"❌ 邀請用戶時發生錯誤: {e}")
        return jsonify({'error': '邀請用戶時發生錯誤'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    try:
        # 檢查資料庫連線
        session = Session()
        session.execute(text("SELECT 1"))
        session.close()
        
        return jsonify({
            'status': 'healthy',
            'bot_online': bot.is_ready(),
            'guild_count': len(bot.guilds),
            'tasks_running': {
                'check_bookings': check_bookings.is_running(),
                'check_new_bookings': check_new_bookings.is_running(),
                'database_health_check': database_health_check.is_running()
            }
        })
        except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

# 啟動 Flask 應用程式
def run_flask():
    """在單獨的線程中運行 Flask 應用程式"""
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)

# 主函數
async def main():
    """主函數"""
    print("🚀 啟動 PeiPlay Discord Bot...")
    
    # 在單獨的線程中啟動 Flask
    import threading
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    print("✅ Flask API 伺服器已啟動 (端口 5001)")
    
    # 啟動 Discord Bot
    try:
        await bot.start(DISCORD_TOKEN)
        except Exception as e:
        print(f"❌ 啟動 Discord Bot 失敗: {e}")

if __name__ == "__main__":
    asyncio.run(main())