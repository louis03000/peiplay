#!/usr/bin/env python3
"""
測試檢查遺失評價功能的腳本（擴展版本）
"""

import discord
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta

# 載入環境變數
load_dotenv()

# 設定
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
ADMIN_CHANNEL_ID = 1419601068110778450
POSTGRES_CONN = os.getenv("POSTGRES_CONN")

# 資料庫設定
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

async def test_missing_ratings_extended():
    """測試檢查遺失評價功能（擴展版本）"""
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
        
        # 獲取管理員頻道
        admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
        
        if not admin_channel:
            print(f"❌ 找不到管理員頻道 (ID: {ADMIN_CHANNEL_ID})")
            await bot.close()
            return
        
        # 手動執行檢查遺失評價的邏輯
        try:
            with Session() as s:
                # 查找已結束但沒有評價記錄的預約
                now = datetime.now(timezone.utc)
                
                # 查找所有已結束的預約（放寬時間條件）
                missing_ratings = s.execute(text("""
                    SELECT 
                        b.id, c.name as customer_name, p.name as partner_name,
                        s."endTime"
                    FROM "Booking" b
                    JOIN "Schedule" s ON s.id = b."scheduleId"
                    JOIN "Customer" c ON c.id = b."customerId"
                    JOIN "Partner" p ON p.id = s."partnerId"
                    WHERE b.status = 'CONFIRMED'
                    AND s."endTime" < :now
                    AND s."endTime" >= :recent_time
                    AND (b."discordVoiceChannelId" IS NOT NULL OR b."discordTextChannelId" IS NOT NULL)
                """), {
                    "now": now,
                    "recent_time": now - timedelta(hours=48)  # 檢查最近48小時的預約
                }).fetchall()
                
                print(f"找到 {len(missing_ratings)} 個可能遺失評價的預約")
                
                if missing_ratings:
                    for booking in missing_ratings:
                        try:
                            # 計算結束時間
                            end_time = booking.endTime
                            if end_time.tzinfo is None:
                                end_time = end_time.replace(tzinfo=timezone.utc)
                            
                            time_since_end = (now - end_time).total_seconds() / 60  # 分鐘
                            
                            await admin_channel.send(
                                f"**{booking.customer_name}** 評價 **{booking.partner_name}**\n"
                                f"⭐ 未評價\n"
                                f"💬 顧客未填寫評價（預約已結束 {time_since_end:.0f} 分鐘）"
                            )
                            print(f"✅ 已發送遺失評價到管理員頻道: {booking.customer_name} → {booking.partner_name} (結束 {time_since_end:.0f} 分鐘前)")
                        except Exception as e:
                            print(f"❌ 發送遺失評價失敗: {e}")
                    
                    # 清除頻道記錄，避免重複處理
                    booking_ids = [b.id for b in missing_ratings]
                    s.execute(text("""
                        UPDATE "Booking" 
                        SET "discordVoiceChannelId" = NULL, "discordTextChannelId" = NULL
                        WHERE id = ANY(:booking_ids)
                    """), {"booking_ids": booking_ids})
                    s.commit()
                    print(f"✅ 已清除 {len(booking_ids)} 個預約的頻道記錄")
                else:
                    print("沒有找到遺失評價的預約")
                    
        except Exception as e:
            print(f"❌ 檢查遺失評價時發生錯誤: {e}")
        
        await bot.close()
    
    try:
        await bot.start(TOKEN)
    except Exception as e:
        print(f"❌ Bot 啟動失敗：{e}")

if __name__ == "__main__":
    asyncio.run(test_missing_ratings_extended())
