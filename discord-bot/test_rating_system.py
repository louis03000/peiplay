#!/usr/bin/env python3
"""
測試評價系統的腳本
"""

import os
import sys
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 檢查環境變數
print("=== 環境變數檢查 ===")
print(f"DISCORD_BOT_TOKEN: {'已設定' if os.getenv('DISCORD_BOT_TOKEN') else '未設定'}")
print(f"DISCORD_GUILD_ID: {os.getenv('DISCORD_GUILD_ID', '未設定')}")
print(f"ADMIN_CHANNEL_ID: {os.getenv('ADMIN_CHANNEL_ID', '未設定')}")
print(f"POSTGRES_CONN: {'已設定' if os.getenv('POSTGRES_CONN') else '未設定'}")

# 檢查 Bot 程式碼中的設定
print("\n=== Bot 程式碼設定檢查 ===")
try:
    from bot import ADMIN_CHANNEL_ID, TOKEN, GUILD_ID
    print(f"Bot 中的 ADMIN_CHANNEL_ID: {ADMIN_CHANNEL_ID}")
    print(f"Bot 中的 TOKEN: {'已設定' if TOKEN else '未設定'}")
    print(f"Bot 中的 GUILD_ID: {GUILD_ID}")
except Exception as e:
    print(f"載入 Bot 模組失敗: {e}")

print("\n=== 測試完成 ===")