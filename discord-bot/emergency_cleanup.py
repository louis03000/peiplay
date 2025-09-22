#!/usr/bin/env python3
"""
緊急清理腳本 - 不需要 Discord Bot 運行
直接通過 Discord API 清理頻道
"""

import asyncio
import discord
import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 從主目錄載入環境變數
load_dotenv('../.env.local')
load_dotenv('../.env')

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))

async def emergency_cleanup():
    """緊急清理所有頻道"""
    if not TOKEN or not GUILD_ID:
        print("❌ 缺少必要的環境變數")
        print("請設定 DISCORD_BOT_TOKEN 和 DISCORD_GUILD_ID")
        return False
    
    try:
        # 初始化 Discord 客戶端
        intents = discord.Intents.default()
        intents.message_content = True
        client = discord.Client(intents=intents)
        
        @client.event
        async def on_ready():
            print(f"✅ Bot 已上線：{client.user}")
            
            guild = client.get_guild(GUILD_ID)
            if not guild:
                print("❌ 找不到 Discord 伺服器")
                await client.close()
                return
            
            print(f"🔍 開始清理伺服器: {guild.name}")
            
            deleted_count = 0
            
            # 清理所有語音頻道
            for channel in guild.voice_channels:
                try:
                    # 檢查是否是預約頻道（包含日期時間格式）
                    if any(char.isdigit() for char in channel.name) and ('/' in channel.name or '-' in channel.name):
                        print(f"🗑️ 刪除語音頻道: {channel.name}")
                        await channel.delete()
                        deleted_count += 1
                except Exception as e:
                    print(f"❌ 刪除語音頻道 {channel.name} 失敗: {e}")
            
            # 清理所有文字頻道（匿名文字區）
            for channel in guild.text_channels:
                try:
                    if "匿名文字區" in channel.name or "🔒" in channel.name:
                        print(f"🗑️ 刪除文字頻道: {channel.name}")
                        await channel.delete()
                        deleted_count += 1
                except Exception as e:
                    print(f"❌ 刪除文字頻道 {channel.name} 失敗: {e}")
            
            print(f"🎉 清理完成！共刪除了 {deleted_count} 個頻道")
            await client.close()
        
        await client.start(TOKEN)
        return True
        
    except Exception as error:
        print(f"❌ 緊急清理失敗: {error}")
        return False

if __name__ == "__main__":
    print("🚨 PeiPlay Discord 緊急清理工具")
    print("=" * 50)
    print("⚠️  此腳本將刪除所有包含日期時間的語音頻道")
    print("⚠️  以及所有「匿名文字區」文字頻道")
    print("=" * 50)
    
    # 執行清理
    result = asyncio.run(emergency_cleanup())
    
    if result:
        print("\n✅ 緊急清理完成！")
    else:
        print("\n❌ 緊急清理失敗！")
