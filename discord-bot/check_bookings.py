#!/usr/bin/env python3
"""
檢查預約狀態的腳本
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta

# 載入環境變數
load_dotenv()

# 資料庫設定
POSTGRES_CONN = os.getenv("POSTGRES_CONN")
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

def check_bookings():
    """檢查預約狀態"""
    print("=== 檢查預約狀態 ===")
    
    with Session() as s:
        # 檢查所有預約
        bookings = s.execute(text("""
            SELECT 
                b.id, b.status, b."createdAt", b."updatedAt",
                c.name as customer_name, p.name as partner_name,
                s."startTime", s."endTime"
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            JOIN "Customer" c ON c.id = b."customerId"
            JOIN "Partner" p ON p.id = s."partnerId"
            ORDER BY s."startTime" DESC
            LIMIT 10
        """)).fetchall()
        
        print(f"找到 {len(bookings)} 個最近的預約：")
        
        now = datetime.now(timezone.utc)
        
        for booking in bookings:
            start_time = booking.startTime
            end_time = booking.endTime
            
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            
            # 計算時間差
            time_to_start = (start_time - now).total_seconds()
            time_to_end = (end_time - now).total_seconds()
            
            print(f"\n預約 ID: {booking.id}")
            print(f"  狀態: {booking.status}")
            print(f"  顧客: {booking.customer_name}")
            print(f"  夥伴: {booking.partner_name}")
            print(f"  開始時間: {start_time}")
            print(f"  結束時間: {end_time}")
            print(f"  距離開始: {time_to_start/60:.1f} 分鐘")
            print(f"  距離結束: {time_to_end/60:.1f} 分鐘")
            
            # 檢查是否應該觸發評價系統
            if time_to_end < 0:
                print(f"  ⚠️  預約已結束，應該觸發評價系統")
            elif time_to_end < 300:  # 5分鐘內結束
                print(f"  ⏰  預約即將結束，應該發送5分鐘提醒")
            elif time_to_end < 600:  # 10分鐘內結束
                print(f"  📅  預約即將結束")
        
        # 檢查是否有語音頻道創建記錄
        print("\n=== 檢查語音頻道記錄 ===")
        voice_channels = s.execute(text("""
            SELECT 
                b.id, b."discordVoiceChannelId", b."discordTextChannelId",
                c.name as customer_name, p.name as partner_name,
                s."startTime", s."endTime"
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            JOIN "Customer" c ON c.id = b."customerId"
            JOIN "Partner" p ON p.id = s."partnerId"
            WHERE b."discordVoiceChannelId" IS NOT NULL
            ORDER BY s."startTime" DESC
            LIMIT 5
        """)).fetchall()
        
        print(f"找到 {len(voice_channels)} 個有語音頻道的預約：")
        
        for vc in voice_channels:
            print(f"\n預約 ID: {vc.id}")
            print(f"  語音頻道 ID: {vc.discordVoiceChannelId}")
            print(f"  文字頻道 ID: {vc.discordTextChannelId}")
            print(f"  顧客: {vc.customer_name}")
            print(f"  夥伴: {vc.partner_name}")
            print(f"  開始時間: {vc.startTime}")
            print(f"  結束時間: {vc.endTime}")

if __name__ == "__main__":
    check_bookings()
