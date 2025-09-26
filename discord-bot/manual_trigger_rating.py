#!/usr/bin/env python3
"""
手動觸發評價系統的腳本
"""

import discord
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

# 載入環境變數
load_dotenv()

# 設定
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
ADMIN_CHANNEL_ID = 1419601068110778450
POSTGRES_CONN = os.getenv("POSTGRES_CONN")

# 資料庫設定
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

async def manual_trigger_rating():
    """手動觸發評價系統"""
    if not TOKEN:
        print("❌ 錯誤：未設定 DISCORD_BOT_TOKEN")
        return
    
    # 創建 Bot 實例
    intents = discord.Intents.default()
    intents.message_content = True
    bot = discord.Client(intents=intents)
    
    @bot.event
    async def on_ready():
        print(f"✅ Bot 已上線：{bot.user}")
        
        # 獲取即將結束的預約
        with Session() as s:
            booking = s.execute(text("""
                SELECT 
                    b.id, b."discordVoiceChannelId", b."discordTextChannelId",
                    c.name as customer_name, p.name as partner_name,
                    s."startTime", s."endTime"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "Partner" p ON p.id = s."partnerId"
                WHERE b."discordVoiceChannelId" IS NOT NULL
                AND b.status = 'CONFIRMED'
                ORDER BY s."endTime" DESC
                LIMIT 1
            """)).fetchone()
            
            if not booking:
                print("❌ 找不到有語音頻道的預約")
                await bot.close()
                return
            
            print(f"找到預約：{booking.id}")
            print(f"  語音頻道 ID: {booking.discordVoiceChannelId}")
            print(f"  文字頻道 ID: {booking.discordTextChannelId}")
            print(f"  顧客: {booking.customer_name}")
            print(f"  夥伴: {booking.partner_name}")
            print(f"  結束時間: {booking.endTime}")
            
            # 獲取語音頻道和文字頻道
            voice_channel = bot.get_channel(booking.discordVoiceChannelId)
            text_channel = bot.get_channel(booking.discordTextChannelId)
            
            if not voice_channel:
                print(f"❌ 找不到語音頻道 (ID: {booking.discordVoiceChannelId})")
                await bot.close()
                return
            
            if not text_channel:
                print(f"❌ 找不到文字頻道 (ID: {booking.discordTextChannelId})")
                await bot.close()
                return
            
            print(f"✅ 找到語音頻道：{voice_channel.name}")
            print(f"✅ 找到文字頻道：{text_channel.name}")
            
            # 手動觸發評價系統
            try:
                # 關閉語音頻道
                await voice_channel.delete()
                print("✅ 已關閉語音頻道")
                
                # 發送評價系統
                from bot import RatingView
                view = RatingView(booking.id)
                await text_channel.send(
                    "🎉 預約時間結束！\n"
                    "請為您的遊戲夥伴評分：\n\n"
                    "點擊下方按鈕選擇星等，系統會彈出評價表單讓您填寫評論。",
                    view=view
                )
                print("✅ 已發送評價系統")
                
                # 發送測試訊息到管理員頻道
                admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
                if admin_channel:
                    await admin_channel.send(
                        f"🧪 **測試評價系統**\n"
                        f"**{booking.customer_name}** 評價 **{booking.partner_name}**\n"
                        f"⭐ {'⭐' * 5}\n"
                        f"💬 這是手動觸發的測試評價"
                    )
                    print("✅ 已發送測試評價到管理員頻道")
                
            except Exception as e:
                print(f"❌ 觸發評價系統失敗：{e}")
        
        await bot.close()
    
    try:
        await bot.start(TOKEN)
    except Exception as e:
        print(f"❌ Bot 啟動失敗：{e}")

if __name__ == "__main__":
    asyncio.run(manual_trigger_rating())
