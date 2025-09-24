#!/usr/bin/env python3
"""
調試預約狀態的腳本
用於檢查為什麼語音頻道沒有創建
"""

import os
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

POSTGRES_CONN = os.getenv("POSTGRES_CONN")

# 資料庫連接
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

def debug_booking_status():
    """調試預約狀態"""
    try:
        with Session() as s:
            # 查詢最近的預約
            query = """
            SELECT 
                b.id, b."customerId", b."scheduleId", b.status, b."createdAt", b."updatedAt",
                b."discordTextChannelId", b."discordVoiceChannelId",
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
            WHERE b."createdAt" >= NOW() - INTERVAL '24 hours'
            ORDER BY b."createdAt" DESC
            LIMIT 10
            """
            
            result = s.execute(text(query))
            bookings = result.fetchall()
            
            print(f"🔍 最近 24 小時內的預約:")
            print("=" * 80)
            
            now = datetime.now(timezone.utc)
            
            for booking in bookings:
                print(f"📋 預約ID: {booking.id}")
                print(f"   狀態: {booking.status}")
                print(f"   開始時間: {booking.startTime}")
                print(f"   結束時間: {booking.endTime}")
                print(f"   文字頻道ID: {booking.discordTextChannelId}")
                print(f"   語音頻道ID: {booking.discordVoiceChannelId}")
                print(f"   顧客Discord: {booking.customer_discord}")
                print(f"   夥伴Discord: {booking.partner_discord}")
                print(f"   即時預約: {booking.is_instant_booking}")
                print(f"   延遲分鐘: {booking.discord_delay_minutes}")
                
                # 計算時間差
                if booking.startTime:
                    time_diff = (booking.startTime - now).total_seconds() / 60
                    print(f"   距離開始: {time_diff:.1f} 分鐘")
                
                print("-" * 40)
            
            # 檢查特定時間窗口的預約
            print(f"\n🔍 檢查語音頻道創建條件:")
            print("=" * 80)
            
            window_start = now - timedelta(minutes=10)
            window_end = now + timedelta(minutes=5)
            
            print(f"時間窗口: {window_start} 到 {window_end}")
            print(f"當前時間: {now}")
            
            # 查詢符合條件的預約
            condition_query = """
            SELECT 
                b.id, b.status, s."startTime", s."endTime",
                b."discordTextChannelId", b."discordVoiceChannelId"
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            WHERE b.status IN ('CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED')
            AND s."startTime" >= :start_time_1
            AND s."startTime" <= :start_time_2
            AND (b."discordTextChannelId" IS NULL AND b."discordVoiceChannelId" IS NULL)
            """
            
            condition_result = s.execute(text(condition_query), {
                "start_time_1": window_start, 
                "start_time_2": window_end
            })
            
            condition_bookings = condition_result.fetchall()
            
            print(f"符合語音頻道創建條件的預約: {len(condition_bookings)} 個")
            
            for booking in condition_bookings:
                print(f"  - 預約ID: {booking.id}, 狀態: {booking.status}, 開始時間: {booking.startTime}")
            
    except Exception as e:
        print(f"❌ 調試預約狀態時發生錯誤: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔍 開始調試預約狀態...")
    debug_booking_status()
    print("✅ 調試完成")
