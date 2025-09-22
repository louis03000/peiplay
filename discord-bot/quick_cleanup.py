#!/usr/bin/env python3
"""
快速清理重複頻道腳本
"""
import discord
import asyncio
import os

# 直接使用環境變數（如果沒有 .env 文件）
TOKEN = os.getenv('DISCORD_BOT_TOKEN')
GUILD_ID = 1410318589348810923  # 從 bot.py 中獲取的 GUILD_ID

if not TOKEN:
    print("❌ 請設定 DISCORD_BOT_TOKEN 環境變數")
    exit(1)

# 創建 Discord 客戶端
intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f'✅ Bot 已上線: {client.user}')
    
    guild = client.get_guild(GUILD_ID)
    if not guild:
        print("❌ 找不到 Discord 伺服器")
        await client.close()
        return
    
    print(f"🔍 開始清理重複頻道...")
    
    # 獲取所有文字頻道
    text_channels = [ch for ch in guild.channels if isinstance(ch, discord.TextChannel)]
    
    # 統計頻道名稱
    channel_names = {}
    for channel in text_channels:
        name = channel.name
        if name not in channel_names:
            channel_names[name] = []
        channel_names[name].append(channel)
    
    # 找出重複的頻道
    duplicate_channels = []
    for name, channels in channel_names.items():
        if len(channels) > 1:
            print(f"🔍 發現重複頻道: {name} (共 {len(channels)} 個)")
            # 保留第一個，刪除其他的
            for i, channel in enumerate(channels[1:], 1):
                duplicate_channels.append(channel)
                print(f"  - 將刪除: {channel.name} (ID: {channel.id})")
    
    if not duplicate_channels:
        print("✅ 沒有發現重複頻道")
    else:
        print(f"🗑️ 準備刪除 {len(duplicate_channels)} 個重複頻道...")
        
        # 刪除重複頻道
        deleted_count = 0
        for channel in duplicate_channels:
            try:
                await channel.delete()
                deleted_count += 1
                print(f"✅ 已刪除頻道: {channel.name}")
            except Exception as e:
                print(f"❌ 刪除頻道失敗 {channel.name}: {e}")
        
        print(f"🎉 清理完成！共刪除 {deleted_count} 個重複頻道")
    
    await client.close()

if __name__ == "__main__":
    print("🚀 啟動快速清理腳本...")
    client.run(TOKEN)
