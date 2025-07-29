# Discord Bot 設定指南

## 概述

PeiPlay 的 Discord Bot 會在預約確認後自動創建匿名語音頻道，讓客戶和夥伴可以進行語音通話。

## 功能特色

- 🎯 自動創建匿名語音頻道
- ⏰ 定時啟動（預約開始前 2 分鐘）
- 🔒 匿名文字聊天區
- ⭐ 匿名評分系統
- 🔄 延長功能（最多 10 分鐘）

## 設定步驟

### 1. 創建 Discord Bot

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點擊 "New Application"
3. 輸入應用程式名稱（例如：PeiPlay Bot）
4. 進入 "Bot" 頁面
5. 點擊 "Add Bot"
6. 複製 Bot Token（這是你需要的 `DISCORD_BOT_TOKEN`）

### 2. 設定 Bot 權限

1. 在 Bot 頁面，開啟以下權限：
   - `Send Messages`
   - `Manage Channels`
   - `Move Members`
   - `Use Voice Activity`
   - `Connect`
   - `Speak`

2. 在 "Privileged Gateway Intents" 中開啟：
   - `Server Members Intent`
   - `Message Content Intent`

### 3. 邀請 Bot 到伺服器

1. 前往 "OAuth2" > "URL Generator"
2. 選擇 "bot" scope
3. 選擇上述權限
4. 複製生成的邀請連結
5. 在瀏覽器中開啟連結，邀請 Bot 到你的伺服器

### 4. 取得伺服器資訊

1. **伺服器 ID**：
   - 右鍵點擊伺服器名稱
   - 選擇 "複製伺服器 ID"
   - 這是你的 `DISCORD_GUILD_ID`

2. **管理員頻道 ID**：
   - 右鍵點擊管理員頻道
   - 選擇 "複製頻道 ID"
   - 這是你的 `ADMIN_CHANNEL_ID`

### 5. 設定環境變數

1. 複製環境變數範例：
   ```bash
   cp discord_bot_env_example.env .env
   ```

2. 編輯 `.env` 檔案，填入正確的設定：
   ```env
   DISCORD_BOT_TOKEN=你的_bot_token
   DISCORD_GUILD_ID=你的伺服器_id
   ADMIN_CHANNEL_ID=你的管理員頻道_id
   DATABASE_URL=postgresql://username:password@localhost:5432/peiplay_db
   PEIPLAY_API_URL=http://localhost:3004
   ```

### 6. 安裝 Python 依賴

```bash
pip install -r requirements.txt
```

### 7. 創建 Discord 伺服器分類

在你的 Discord 伺服器中創建一個名為「語音頻道」的分類（Category）。

### 8. 設定用戶 Discord 名稱

確保用戶在 PeiPlay 個人資料中設定了 Discord 名稱。

## 啟動 Bot

### 方法一：使用啟動腳本（推薦）

```bash
python start_discord_bot.py
```

### 方法二：直接啟動

```bash
python discord_bot_peiplay.py
```

## 運作流程

1. **預約確認**：當夥伴接受預約後，狀態變為 `CONFIRMED`
2. **自動檢查**：Bot 每 30 秒檢查一次即將開始的預約
3. **創建頻道**：在預約開始前 2 分鐘自動創建語音頻道
4. **移動用戶**：自動將客戶和夥伴移動到語音頻道
5. **匿名評分**：頻道關閉後提供匿名評分功能

## 故障排除

### Bot 無法啟動

- 檢查 `DISCORD_BOT_TOKEN` 是否正確
- 確認 Bot 已加入伺服器
- 檢查 Bot 權限是否足夠

### 無法創建語音頻道

- 確認 Bot 有管理頻道權限
- 檢查「語音頻道」分類是否存在
- 確認伺服器 ID 正確

### 用戶無法加入頻道

- 檢查用戶的 Discord 名稱是否正確設定
- 確認用戶在 Discord 伺服器中
- 檢查 Bot 是否有移動成員權限

### 預約沒有觸發語音頻道

- 確認預約狀態為 `CONFIRMED`
- 檢查用戶是否設定了 Discord 名稱
- 確認預約時間在未來 2 分鐘內

## 測試

1. 創建一個測試預約
2. 確保預約狀態為 `CONFIRMED`
3. 等待預約開始前 2 分鐘
4. 檢查是否自動創建了語音頻道

## 注意事項

- Bot 需要持續運行才能自動創建頻道
- 確保資料庫連接正常
- 建議在測試環境先測試功能
- 定期檢查 Bot 日誌以確保正常運作