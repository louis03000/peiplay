#!/usr/bin/env python3
"""
修復 SQL 語法錯誤的 Discord Bot
確保所有 SQL 查詢使用統一的參數格式
"""

import discord
from discord.ext import commands, tasks
import asyncio
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import json
import random

# 載入環境變數
load_dotenv()

# 環境變數
TOKEN = os.getenv('DISCORD_BOT_TOKEN')
GUILD_ID = int(os.getenv('DISCORD_GUILD_ID', '0'))
POSTGRES_CONN = os.getenv('POSTGRES_CONN')
ADMIN_CHANNEL_ID = int(os.getenv('ADMIN_CHANNEL_ID', '1419601068110778450'))
CHANNEL_CREATION_CHANNEL_ID = int(os.getenv('CHANNEL_CREATION_CHANNEL_ID', '0'))
CHECK_INTERVAL = int(os.getenv('CHECK_INTERVAL', '30'))

# 檢查必要的環境變數
if not all([TOKEN, GUILD_ID, POSTGRES_CONN]):
    print("❌ 缺少必要的環境變數")
    exit(1)

# 資料庫連接
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

# Bot 設定
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
bot = commands.Bot(command_prefix='!', intents=intents)

# 全域變數
active_voice_channels = {}
processed_bookings = set()
processed_text_channels = set()

# 修復的 check_new_bookings 函數
@tasks.loop(seconds=60)
async def check_new_bookings_fixed():
    """修復版本的檢查新預約函數"""
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
                # 將 processed_list 轉換為 PostgreSQL 陣列格式
                processed_array = "{" + ",".join(map(str, processed_list)) + "}"
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
                 AND b.id NOT IN (SELECT unnest(:processed_array::int[]))
                """
                result = s.execute(text(query), {"recent_time": recent_time, "processed_array": processed_array})
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
                WHERE b.status IN ('PAID_WAITING_PARTNER_CONFIRMATION', 'PARTNER_ACCEPTED', 'CONFIRMED')
                 AND b."createdAt" >= :recent_time
                """
                result = s.execute(text(simple_query), {"recent_time": recent_time})
            
            print(f"🔍 檢查新預約完成，找到 {len(list(result))} 個預約")
            
    except Exception as e:
        print(f"❌ 檢查新預約時發生錯誤: {e}")

# 修復的 check_bookings 函數
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_bookings_fixed():
    """修復版本的檢查預約函數"""
    await bot.wait_until_ready()
    
    try:
        print(f"🔍 check_bookings_fixed 函數開始執行")
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        # 查詢已確認且即將開始的預約（只創建語音頻道）
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=10)  # 擴展到過去10分鐘，處理延遲的情況
        window_end = now + timedelta(minutes=5)  # 5分鐘內即將開始
        
        print(f"🔍 檢查預約時間窗口: {window_start} 到 {window_end}")
        print(f"🔍 當前時間: {now}")
        
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
        AND (b."discordTextChannelId" IS NULL AND b."discordVoiceChannelId" IS NULL)
        """
        
        with Session() as s:
            result = s.execute(text(query), {"start_time_1": window_start, "start_time_2": window_end})
            bookings = result.fetchall()
            
            print(f"🔍 找到 {len(bookings)} 個預約需要創建語音頻道")
            
            for booking in bookings:
                print(f"🔍 處理預約 {booking.id}: 狀態={booking.status}, 開始時間={booking.startTime}")
                # 這裡可以添加語音頻道創建邏輯
                
    except Exception as e:
        print(f"❌ 檢查預約時發生錯誤: {e}")

@bot.event
async def on_ready():
    print(f"✅ Bot 上線：{bot.user}")
    try:
        guild = discord.Object(id=GUILD_ID)
        synced = await bot.tree.sync(guild=guild)
        print(f"✅ Slash 指令已同步：{len(synced)} 個指令")
        
        # 啟動修復版本的任務
        check_new_bookings_fixed.start()
        check_bookings_fixed.start()
        print("✅ 修復版本的檢查任務已啟動")
        
    except Exception as e:
        print(f"❌ Bot 啟動時發生錯誤: {e}")

# 啟動 bot
if __name__ == "__main__":
    print("🚀 啟動修復版本的 Discord Bot...")
    bot.run(TOKEN)
