# PeiPlay Discord Bot

Discord Bot for PeiPlay voice channel management and user pairing.

## 功能特色

- 🎤 匿名語音頻道創建和管理
- 👥 用戶配對和匹配
- ⏰ 定時啟動和自動清理
- 📊 統計追蹤
- 🚫 用戶封鎖系統
- ⭐ 匿名評分和回饋系統
- 🔄 延長功能（最多 10 分鐘）
- 🤖 **自動化預約處理**：付款成功後自動創建語音頻道

## 自動化功能

### 預約自動處理
- **觸發條件**：當預約狀態變為 `CONFIRMED` 或 `COMPLETED` 時
- **檢查頻率**：每 30 秒檢查一次（可配置）
- **啟動時間**：預約開始前 5 分鐘自動創建頻道
- **權限控制**：只有預約的顧客和夥伴可以進入頻道
- **自動移動**：將用戶自動移動到語音頻道

### 資料庫整合
- 自動從資料庫獲取顧客和夥伴的 Discord 名稱
- 根據預約時間計算頻道持續時間
- 記錄配對資訊和評分資料
- 關聯預約 ID 到配對記錄

## 快速設定

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 設定環境變數

複製環境變數範例：
```bash
cp env.example .env
```

編輯 `.env` 檔案：
```env
DISCORD_BOT_TOKEN=你的_bot_token
DISCORD_GUILD_ID=你的伺服器_id
ADMIN_CHANNEL_ID=你的管理員頻道_id
POSTGRES_CONN=你的資料庫連接字串  # 使用與 PeiPlay 相同的資料庫
CHECK_INTERVAL=30  # 檢查間隔（秒）
```

**注意**：Bot 使用與 PeiPlay 相同的資料庫，確保 `POSTGRES_CONN` 指向正確的資料庫。

### 3. 啟動 Bot

使用啟動腳本（推薦）：
```bash
python start_discord_bot.py
```

或直接啟動：
```bash
python bot.py
```

## Discord Bot 設定

### 1. 創建 Discord Bot

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點擊 "New Application"
3. 輸入應用程式名稱（例如：PeiPlay Bot）
4. 進入 "Bot" 頁面
5. 點擊 "Add Bot"
6. 複製 Bot Token

### 2. 設定 Bot 權限

在 Bot 頁面開啟以下權限：
- `Send Messages`
- `Manage Channels`
- `Move Members`
- `Use Voice Activity`
- `Connect`
- `Speak`

在 "Privileged Gateway Intents" 中開啟：
- `Server Members Intent`
- `Message Content Intent`

### 3. 邀請 Bot 到伺服器

1. 前往 "OAuth2" > "URL Generator"
2. 選擇 "bot" scope
3. 選擇上述權限
4. 複製生成的邀請連結
5. 在瀏覽器中開啟連結

### 4. 取得伺服器資訊

- **伺服器 ID**：右鍵點擊伺服器名稱 → 複製伺服器 ID
- **管理員頻道 ID**：右鍵點擊管理員頻道 → 複製頻道 ID

### 5. 創建 Discord 分類

在 Discord 伺服器中創建名為「語音頻道」的分類（Category）。

### 6. 設定用戶 Discord 名稱

**✅ 已完成**：用戶在註冊 PeiPlay 時已經設定了 Discord 名稱，Bot 會自動從資料庫獲取這些資訊。

## 運作流程

### 自動化流程
1. **預約確認**：當夥伴接受預約並付款成功後
2. **自動檢查**：Bot 每 30 秒檢查一次即將開始的預約
3. **創建頻道**：在預約開始前 5 分鐘自動創建語音頻道
4. **權限設定**：只有預約的顧客和夥伴可以進入
5. **自動移動**：將用戶移動到語音頻道
6. **倒數計時**：顯示剩餘時間，可延長 10 分鐘
7. **匿名評分**：頻道關閉後提供評分功能
8. **自動清理**：刪除頻道和文字區

### 手動流程
1. **建立頻道**：使用 `/createvc` 指令
2. **定時啟動**：Bot 會在指定時間自動創建語音頻道
3. **自動移動**：將用戶移動到語音頻道
4. **倒數計時**：顯示剩餘時間，可延長 10 分鐘
5. **匿名評分**：頻道關閉後提供評分功能
6. **自動清理**：刪除頻道和文字區

## 指令說明

### Slash 指令

- `/createvc` - 建立匿名語音頻道
  - `members`: 標註的成員們
  - `minutes`: 存在時間（分鐘）
  - `start_time`: 啟動時間（格式: HH:MM, 24hr）
  - `limit`: 人數上限（預設: 2）

- `/viewblocklist` - 查看你封鎖的使用者

- `/unblock` - 解除你封鎖的某人
  - `member`: 要解除封鎖的使用者

- `/report` - 舉報不當行為
  - `member`: 被舉報的使用者
  - `reason`: 舉報原因

- `/mystats` - 查詢自己的配對統計

- `/stats` - 查詢他人配對統計（限管理員）
  - `member`: 要查詢的使用者

### 一般指令

- `!ping` - 測試 Bot 連線

## 資料庫結構

### PairingRecord 表
- `id`: 主鍵
- `user1_id`: 用戶 1 的 Discord ID
- `user2_id`: 用戶 2 的 Discord ID
- `timestamp`: 創建時間
- `extended_times`: 延長次數
- `duration`: 總時長（秒）
- `rating`: 評分（1-5）
- `comment`: 留言
- `animal_name`: 動物名稱
- `booking_id`: 關聯的預約 ID

### BlockRecord 表
- `id`: 主鍵
- `blocker_id`: 封鎖者的 Discord ID
- `blocked_id`: 被封鎖者的 Discord ID

## API 端點

### POST /move_user
移動用戶到指定語音頻道

請求體：
```json
{
  "discord_id": "用戶DiscordID",
  "vc_id": "語音頻道ID"
}
```

## 故障排除

### Bot 無法啟動
- 檢查 `DISCORD_BOT_TOKEN` 是否正確
- 確認 Bot 已加入伺服器
- 檢查 Bot 權限是否足夠

### 無法創建語音頻道
- 確認 Bot 有管理頻道權限
- 檢查「語音頻道」分類是否存在
- 確認伺服器 ID 正確

### 自動化功能不工作
- 確認預約狀態為 `CONFIRMED` 或 `COMPLETED`
- 確認用戶在註冊時已設定 Discord 名稱
- 確認預約時間在未來 5 分鐘內
- 檢查資料庫連接是否正常

### 資料庫連接問題
- 檢查 `POSTGRES_CONN` 連接字串
- 確認資料庫服務正在運行
- 檢查資料庫權限

### 指令無法使用
- 確認 Bot 有 `applications.commands` 權限
- 檢查指令是否已同步
- 確認在正確的伺服器中使用

## 部署

### Railway
1. 連接 GitHub 倉庫
2. 設定環境變數
3. 自動部署

### Heroku
1. 創建 Heroku 應用
2. 設定 Python buildpack
3. 設定環境變數
4. 部署

### Docker
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "bot.py"]
```

## 注意事項

- Bot 需要持續運行才能正常運作
- 確保資料庫連接正常
- 建議在測試環境先測試功能
- 定期檢查 Bot 日誌
- 注意 Discord API 限制
- 確保用戶在 PeiPlay 中設定了正確的 Discord 名稱

## 支援

如有問題，請檢查：
1. 環境變數設定
2. Bot 權限設定
3. 資料庫連接
4. Discord 伺服器設定 