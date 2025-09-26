#!/usr/bin/env python3
"""
測試管理員頻道的腳本
"""

import discord
import asyncio
import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# Bot 設定
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
ADMIN_CHANNEL_ID = 1419601068110778450  # 您提供的管理員頻道 ID

async def test_admin_channel():
    """測試管理員頻道連接"""
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
        
        # 嘗試獲取管理員頻道
        admin_channel = bot.get_channel(ADMIN_CHANNEL_ID)
        
        if admin_channel:
            print(f"✅ 找到管理員頻道：{admin_channel.name} (ID: {admin_channel.id})")
            print(f"   頻道類型：{type(admin_channel).__name__}")
            print(f"   伺服器：{admin_channel.guild.name if admin_channel.guild else '未知'}")
            
            # 測試發送訊息
            try:
                await admin_channel.send("🧪 測試訊息：管理員頻道連接正常！")
                print("✅ 測試訊息發送成功！")
            except Exception as e:
                print(f"❌ 發送測試訊息失敗：{e}")
        else:
            print(f"❌ 找不到管理員頻道 (ID: {ADMIN_CHANNEL_ID})")
            print("   可能的原因：")
            print("   1. 頻道 ID 不正確")
            print("   2. Bot 沒有該頻道的權限")
            print("   3. 頻道不存在或已被刪除")
            
            # 列出所有可用的頻道
            print("\n📋 可用的頻道：")
            for guild in bot.guilds:
                print(f"   伺服器：{guild.name}")
                for channel in guild.channels:
                    if isinstance(channel, discord.TextChannel):
                        print(f"     - {channel.name} (ID: {channel.id})")
        
        await bot.close()
    
    try:
        await bot.start(TOKEN)
    except Exception as e:
        print(f"❌ Bot 啟動失敗：{e}")

if __name__ == "__main__":
    asyncio.run(test_admin_channel())
