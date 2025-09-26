#!/usr/bin/env python3
"""
檢查頻道狀態的腳本
"""

import discord
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 載入環境變數
load_dotenv()

# 設定
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
ADMIN_CHANNEL_ID = 1419601068110778450
POSTGRES_CONN = os.getenv("POSTGRES_CONN")

# 資料庫設定
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

async def check_channels():
    """檢查頻道狀態"""
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
        
        # 獲取有頻道記錄的預約
        with Session() as s:
            bookings = s.execute(text("""
                SELECT 
                    b.id, b."discordVoiceChannelId", b."discordTextChannelId",
                    c.name as customer_name, p.name as partner_name,
                    s."startTime", s."endTime"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "Partner" p ON p.id = s."partnerId"
                WHERE (b."discordVoiceChannelId" IS NOT NULL OR b."discordTextChannelId" IS NOT NULL)
                AND b.status = 'CONFIRMED'
                ORDER BY s."endTime" DESC
                LIMIT 5
            """)).fetchall()
            
            print(f"找到 {len(bookings)} 個有頻道記錄的預約：")
            
            for booking in bookings:
                print(f"\n預約 ID: {booking.id}")
                print(f"  顧客: {booking.customer_name}")
                print(f"  夥伴: {booking.partner_name}")
                print(f"  結束時間: {booking.endTime}")
                
                # 檢查語音頻道
                if booking.discordVoiceChannelId:
                    voice_channel = bot.get_channel(booking.discordVoiceChannelId)
                    if voice_channel:
                        print(f"  ✅ 語音頻道存在: {voice_channel.name}")
                    else:
                        print(f"  ❌ 語音頻道不存在: {booking.discordVoiceChannelId}")
                
                # 檢查文字頻道
                if booking.discordTextChannelId:
                    text_channel = bot.get_channel(booking.discordTextChannelId)
                    if text_channel:
                        print(f"  ✅ 文字頻道存在: {text_channel.name}")
                        
                        # 如果文字頻道存在，手動觸發評價系統
                        try:
                            from bot import RatingView
                            view = RatingView(booking.id)
                            await text_channel.send(
                                "🎉 預約時間結束！\n"
                                "請為您的遊戲夥伴評分：\n\n"
                                "點擊下方按鈕選擇星等，系統會彈出評價表單讓您填寫評論。",
                                view=view
                            )
                            print(f"  ✅ 已手動觸發評價系統")
                            
                            # 發送測試訊息到管理員頻道
                            admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
                            if admin_channel:
                                await admin_channel.send(
                                    f"🧪 **手動觸發評價系統**\n"
                                    f"**{booking.customer_name}** 評價 **{booking.partner_name}**\n"
                                    f"⭐ {'⭐' * 5}\n"
                                    f"💬 這是手動觸發的測試評價"
                                )
                                print(f"  ✅ 已發送測試評價到管理員頻道")
                            
                        except Exception as e:
                            print(f"  ❌ 觸發評價系統失敗: {e}")
                    else:
                        print(f"  ❌ 文字頻道不存在: {booking.discordTextChannelId}")
        
        await bot.close()
    
    try:
        await bot.start(TOKEN)
    except Exception as e:
        print(f"❌ Bot 啟動失敗：{e}")

if __name__ == "__main__":
    asyncio.run(check_channels())
