#!/usr/bin/env python3
"""
清理重複的語音頻道腳本
"""

import os
import discord
from discord.ext import commands
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from collections import defaultdict

# 載入環境變數
load_dotenv()

# Discord Bot 設定
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
GUILD_ID = int(os.getenv('GUILD_ID'))

# 資料庫設定
POSTGRES_CONN = os.getenv('POSTGRES_CONN')
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

# 創建 Bot
intents = discord.Intents.default()
intents.guilds = True
intents.voice_states = True
bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'✅ Bot 上線：{bot.user}')
    
    guild = bot.get_guild(GUILD_ID)
    if not guild:
        print("❌ 找不到 Discord 伺服器")
        return
    
    print("🔍 開始清理重複的語音頻道...")
    
    # 按時間分組語音頻道
    voice_channels_by_time = defaultdict(list)
    
    for channel in guild.voice_channels:
        if channel.name.startswith("📅"):
            # 提取時間信息
            try:
                # 格式: 📅09/25 10:00-10:30 🦁 獅子
                parts = channel.name.split()
                if len(parts) >= 2:
                    time_part = f"{parts[0]} {parts[1]}"  # 📅09/25 10:00-10:30
                    voice_channels_by_time[time_part].append(channel)
            except Exception as e:
                print(f"⚠️ 解析頻道名稱失敗: {channel.name} - {e}")
    
    # 清理重複頻道
    cleaned_count = 0
    for time_key, channels in voice_channels_by_time.items():
        if len(channels) > 1:
            print(f"🔍 發現 {len(channels)} 個重複頻道: {time_key}")
            
            # 保留最新的頻道，刪除其他
            channels.sort(key=lambda x: x.created_at, reverse=True)
            keep_channel = channels[0]
            delete_channels = channels[1:]
            
            print(f"✅ 保留頻道: {keep_channel.name} (創建時間: {keep_channel.created_at})")
            
            for channel in delete_channels:
                try:
                    print(f"🗑️ 刪除重複頻道: {channel.name} (創建時間: {channel.created_at})")
                    await channel.delete()
                    cleaned_count += 1
                except Exception as e:
                    print(f"❌ 刪除頻道失敗: {channel.name} - {e}")
    
    print(f"✅ 清理完成！共刪除 {cleaned_count} 個重複頻道")
    
    # 關閉 Bot
    await bot.close()

if __name__ == "__main__":
    bot.run(DISCORD_TOKEN)
