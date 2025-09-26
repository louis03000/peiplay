#!/usr/bin/env python3
"""
測試評價提交的腳本
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

async def test_rating_submission():
    """測試評價提交功能"""
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
        
        # 測試發送評價訊息
        try:
            # 模擬評價訊息
            test_message = (
                f"**測試顧客** 評價 **測試夥伴**\n"
                f"⭐ {'⭐' * 5}\n"
                f"💬 這是一個測試評價訊息"
            )
            
            await admin_channel.send(test_message)
            print("✅ 測試評價訊息發送成功！")
            
            # 測試未評價訊息
            test_no_rating = (
                f"**測試顧客** 評價 **測試夥伴**\n"
                f"⭐ 未評價\n"
                f"💬 顧客未填寫評價"
            )
            
            await admin_channel.send(test_no_rating)
            print("✅ 測試未評價訊息發送成功！")
            
        except Exception as e:
            print(f"❌ 發送測試訊息失敗：{e}")
        
        await bot.close()
    
    try:
        await bot.start(TOKEN)
    except Exception as e:
        print(f"❌ Bot 啟動失敗：{e}")

if __name__ == "__main__":
    asyncio.run(test_rating_submission())
