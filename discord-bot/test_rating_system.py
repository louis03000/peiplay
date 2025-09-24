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
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "1419601068110778450"))

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
        
        # 檢查管理員頻道
        admin_channel = client.get_channel(ADMIN_CHANNEL_ID)
        if admin_channel:
            print(f"✅ 管理員頻道找到: {admin_channel.name} (ID: {ADMIN_CHANNEL_ID})")
        else:
            print(f"❌ 找不到管理員頻道 (ID: {ADMIN_CHANNEL_ID})")
        
        # 查詢最近的配對記錄
        with Session() as s:
            query = """
            SELECT 
                pr.id, pr.user1_id, pr.user2_id, pr.rating, pr.comment, pr.created_at,
                b.id as booking_id, b.status
            FROM "PairingRecord" pr
            LEFT JOIN "Booking" b ON b.id = pr.booking_id
            ORDER BY pr.created_at DESC
            LIMIT 5
            """
            result = s.execute(text(query))
            records = result.fetchall()
            
            print(f"📊 最近的配對記錄:")
            for record in records:
                print(f"  - ID: {record.id}, 用戶: {record.user1_id} × {record.user2_id}")
                print(f"    評分: {record.rating}, 留言: {record.comment}")
                print(f"    預約ID: {record.booking_id}, 狀態: {record.status}")
                print()
        
        # 測試發送評價訊息到管理員頻道
        if admin_channel:
            embed = discord.Embed(
                title="🧪 評價系統測試",
                description="這是一個測試訊息，用於驗證評價系統是否正常工作。",
                color=0x00ff00,
                timestamp=datetime.now(timezone.utc)
            )
            embed.add_field(
                name="✅ 系統狀態",
                value="評價系統運行正常",
                inline=True
            )
            embed.add_field(
                name="📋 管理員頻道ID",
                value=f"`{ADMIN_CHANNEL_ID}`",
                inline=True
            )
            embed.set_footer(text="PeiPlay 評價系統測試")
            
            await admin_channel.send(embed=embed)
            print("✅ 測試訊息已發送到管理員頻道")
        
        await client.close()
        return True
        
    except Exception as e:
        print(f"❌ 測試評價系統時發生錯誤: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🧪 開始測試評價系統...")
    result = asyncio.run(test_rating_system())
    if result:
        print("✅ 評價系統測試完成")
    else:
        print("❌ 評價系統測試失敗")