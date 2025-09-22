#!/usr/bin/env python3
"""
強力清理腳本 - 刪除所有可能的重複頻道
"""

import asyncio
import discord
import os
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()
load_dotenv('../.env.local')
load_dotenv('../.env')

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))

async def force_cleanup():
    """強力清理所有可能的頻道"""
    if not TOKEN or not GUILD_ID:
        print("❌ 缺少必要的環境變數")
        return False
    
    try:
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
            
            print(f"🔍 開始強力清理伺服器: {guild.name}")
            
            deleted_count = 0
            
            # 清理所有語音頻道
            print("🗑️ 清理語音頻道...")
            for channel in guild.voice_channels:
                try:
                    print(f"   檢查語音頻道: {channel.name}")
                    # 刪除所有語音頻道（除了系統預設的）
                    if not channel.name.startswith("General") and not channel.name.startswith("一般"):
                        print(f"   🗑️ 刪除語音頻道: {channel.name}")
                        await channel.delete()
                        deleted_count += 1
                except Exception as e:
                    print(f"   ❌ 刪除語音頻道 {channel.name} 失敗: {e}")
            
            # 清理所有文字頻道
            print("🗑️ 清理文字頻道...")
            for channel in guild.text_channels:
                try:
                    print(f"   檢查文字頻道: {channel.name}")
                    # 刪除所有文字頻道（除了系統預設的）
                    if not channel.name.startswith("general") and not channel.name.startswith("一般"):
                        print(f"   🗑️ 刪除文字頻道: {channel.name}")
                        await channel.delete()
                        deleted_count += 1
                except Exception as e:
                    print(f"   ❌ 刪除文字頻道 {channel.name} 失敗: {e}")
            
            print(f"🎉 強力清理完成！共刪除了 {deleted_count} 個頻道")
            await client.close()
        
        await client.start(TOKEN)
        return True
        
    except Exception as error:
        print(f"❌ 強力清理失敗: {error}")
        return False

if __name__ == "__main__":
    print("🚨 PeiPlay Discord 強力清理工具")
    print("=" * 50)
    print("⚠️  此腳本將刪除所有非系統預設的頻道")
    print("⚠️  包括所有語音頻道和文字頻道")
    print("=" * 50)
    
    result = asyncio.run(force_cleanup())
    
    if result:
        print("\n✅ 強力清理完成！")
    else:
        print("\n❌ 強力清理失敗！")
