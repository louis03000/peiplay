#!/usr/bin/env python3
"""
測試評價系統的腳本
用於驗證評價系統是否正常工作
"""

import asyncio
import discord
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

# 載入環境變數
load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
POSTGRES_CONN = os.getenv("POSTGRES_CONN")

# 資料庫連接
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

async def test_rating_system():
    """測試評價系統"""
    try:
        # 初始化 Discord 客戶端
        intents = discord.Intents.default()
        intents.message_content = True
        client = discord.Client(intents=intents)
        
        await client.login(TOKEN)
        
        guild = client.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            await client.close()
            return False
        
        print(f"🔍 檢查評價系統狀態...")
        
        # 查詢最近的配對記錄
        with Session() as s:
            recent_records_query = """
            SELECT 
                pr.id, pr.user1_id, pr.user2_id, pr.rating, pr.comment, 
                pr.timestamp, pr.booking_id, pr.animal_name
            FROM pairing_records pr
            ORDER BY pr.timestamp DESC
            LIMIT 10
            """
            
            recent_records = s.execute(text(recent_records_query)).fetchall()
            
            print(f"📊 找到 {len(recent_records)} 個最近的配對記錄")
            
            for record in recent_records:
                record_id = record.id
                user1_id = record.user1_id
                user2_id = record.user2_id
                rating = record.rating
                comment = record.comment
                timestamp = record.timestamp
                booking_id = record.booking_id
                animal_name = record.animal_name
                
                print(f"\n📋 配對記錄 ID: {record_id}")
                print(f"  👤 用戶1: {user1_id}")
                print(f"  👤 用戶2: {user2_id}")
                print(f"  ⭐ 評分: {rating if rating else '未評分'}")
                print(f"  💬 留言: {comment if comment else '無留言'}")
                print(f"  📅 時間: {timestamp}")
                print(f"  🎮 頻道: {animal_name}")
                print(f"  📋 預約ID: {booking_id if booking_id else '無'}")
                
                # 檢查是否有對應的 Discord 頻道
                if booking_id:
                    booking_query = """
                    SELECT 
                        b."discordTextChannelId", b."discordVoiceChannelId", b.status,
                        s."startTime", s."endTime"
                    FROM "Booking" b
                    JOIN "Schedule" s ON s.id = b."scheduleId"
                    WHERE b.id = :booking_id
                    """
                    
                    booking_result = s.execute(text(booking_query), {"booking_id": booking_id}).fetchone()
                    
                    if booking_result:
                        text_channel_id = booking_result.discordTextChannelId
                        voice_channel_id = booking_result.discordVoiceChannelId
                        status = booking_result.status
                        start_time = booking_result.startTime
                        end_time = booking_result.endTime
                        
                        print(f"  📱 文字頻道ID: {text_channel_id if text_channel_id else '無'}")
                        print(f"  🎤 語音頻道ID: {voice_channel_id if voice_channel_id else '無'}")
                        print(f"  📊 預約狀態: {status}")
                        print(f"  ⏰ 開始時間: {start_time}")
                        print(f"  ⏰ 結束時間: {end_time}")
                        
                        # 檢查頻道是否還存在
                        if text_channel_id:
                            text_channel = guild.get_channel(int(text_channel_id))
                            if text_channel:
                                print(f"  ✅ 文字頻道仍存在: {text_channel.name}")
                            else:
                                print(f"  ❌ 文字頻道已刪除")
                        
                        if voice_channel_id:
                            voice_channel = guild.get_channel(int(voice_channel_id))
                            if voice_channel:
                                print(f"  ✅ 語音頻道仍存在: {voice_channel.name}")
                            else:
                                print(f"  ❌ 語音頻道已刪除")
        
        # 檢查最近的預約
        print(f"\n🔍 檢查最近的預約...")
        with Session() as s:
            recent_bookings_query = """
            SELECT 
                b.id, b.status, b."createdAt", b."discordTextChannelId", b."discordVoiceChannelId",
                s."startTime", s."endTime",
                c.name as customer_name, p.name as partner_name
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            JOIN "Customer" c ON c.id = b."customerId"
            JOIN "Partner" p ON p.id = s."partnerId"
            ORDER BY b."createdAt" DESC
            LIMIT 5
            """
            
            recent_bookings = s.execute(text(recent_bookings_query)).fetchall()
            
            print(f"📊 找到 {len(recent_bookings)} 個最近的預約")
            
            for booking in recent_bookings:
                booking_id = booking.id
                status = booking.status
                created_at = booking.createdAt
                text_channel_id = booking.discordTextChannelId
                voice_channel_id = booking.discordVoiceChannelId
                start_time = booking.startTime
                end_time = booking.endTime
                customer_name = booking.customer_name
                partner_name = booking.partner_name
                
                print(f"\n📋 預約 ID: {booking_id}")
                print(f"  👤 顧客: {customer_name}")
                print(f"  👥 夥伴: {partner_name}")
                print(f"  📊 狀態: {status}")
                print(f"  📅 創建時間: {created_at}")
                print(f"  ⏰ 開始時間: {start_time}")
                print(f"  ⏰ 結束時間: {end_time}")
                print(f"  📱 文字頻道ID: {text_channel_id if text_channel_id else '無'}")
                print(f"  🎤 語音頻道ID: {voice_channel_id if voice_channel_id else '無'}")
                
                # 檢查是否有對應的配對記錄
                pairing_query = """
                SELECT id, rating, comment, timestamp
                FROM pairing_records
                WHERE booking_id = :booking_id
                """
                
                pairing_result = s.execute(text(pairing_query), {"booking_id": booking_id}).fetchone()
                
                if pairing_result:
                    print(f"  ✅ 有配對記錄: ID={pairing_result.id}, 評分={pairing_result.rating}, 留言={pairing_result.comment}")
                else:
                    print(f"  ❌ 沒有配對記錄")
        
        await client.close()
        return True
        
    except Exception as error:
        print(f"❌ 測試評價系統失敗: {error}")
        import traceback
        traceback.print_exc()
        try:
            await client.close()
        except:
            pass
        return False

if __name__ == "__main__":
    print("🧪 PeiPlay Discord 評價系統測試工具")
    print("=" * 50)
    
    # 執行測試
    result = asyncio.run(test_rating_system())
    
    if result:
        print("\n✅ 測試完成！")
    else:
        print("\n❌ 測試失敗！")
