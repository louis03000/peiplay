# PeiPlay Discord Bot

這是一個整合 PeiPlay 平台的 Discord Bot，提供匿名語音配對功能。

## 功能特色

- 🎯 匿名語音配對
- ⏰ 定時啟動語音頻道
- ⭐ 匿名評分系統
- 🔄 延長功能
- 📊 統計查詢
- 🚨 舉報系統
- 🌐 PeiPlay 平台整合

## 安裝需求

```bash
pip install discord.py flask requests python-dotenv
```

## 環境設定

1. 複製環境變數範例：
```bash
cp discord_bot_env_example.env .env
```

2. 編輯 `.env` 檔案，填入你的設定：
```env
# Discord Bot 設定
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
ADMIN_CHANNEL_ID=your_admin_channel_id_here

# PeiPlay 整合設定
PEIPLAY_API_URL=http://localhost:3004
DATABASE_URL=postgresql://username:password@localhost:5432/peiplay_db

# 其他設定
FLASK_PORT=5000
```

## 使用方法

### 啟動 Bot
```bash
python peiplay_discord_bot.py
```

### 主要指令

#### `/createvc` - 建立匿名語音頻道
- `members`: 標註的成員們
- `minutes`: 存在時間（分鐘）
- `start_time`: 幾點幾分後啟動 (格式: HH:MM, 24hr)
- `limit`: 人數上限（預設 2）

範例：
```
/createvc members:@user1 @user2 minutes:30 start_time:14:30 limit:2
```

#### `/mystats` - 查詢自己的配對統計
顯示你的配對次數、平均評分和收到的留言數量。

#### `/stats` - 查詢他人配對統計（限管理員）
查詢指定用戶的配對統計資料。

#### `/report` - 舉報不當行為
- `member`: 被舉報的使用者
- `reason`: 舉報原因

#### `/peiplay_status` - 檢查 PeiPlay 連接狀態
檢查 Bot 與 PeiPlay API 的連接狀態。

## 功能說明

### 匿名配對流程
1. 使用 `/createvc` 指令建立配對
2. Bot 會在指定時間創建語音頻道
3. 參與者會被自動移動到語音頻道
4. 頻道會在指定時間後自動關閉
5. 關閉後會提供匿名評分功能

### 延長功能
- 在語音頻道開啟期間，可以點擊「延長 10 分鐘」按鈕
- 建議在最後需要時才使用延長功能

### 評分系統
- 語音頻道關閉後，會提供匿名評分按鈕
- 可以給予 1-5 星評分
- 可以留下匿名留言
- 評價會發送到管理員頻道

### PeiPlay 整合
- Bot 會嘗試將配對記錄同步到 PeiPlay 平台
- 評價也會同步到 PeiPlay 的評價系統
- 可以透過 API 查詢統計資料

## 資料庫整合

Bot 會嘗試與 PeiPlay 的資料庫整合：

1. **配對記錄**: 創建 Discord 配對時會同步到 PeiPlay
2. **評價系統**: 匿名評價會同步到 PeiPlay 的評價系統
3. **用戶統計**: 可以查詢用戶的配對統計

## 注意事項

1. 確保 Discord Bot 有足夠的權限
2. 需要創建「語音頻道」分類
3. PeiPlay API 需要正常運行
4. 建議在測試環境先測試功能

## 故障排除

### Bot 無法啟動
- 檢查 `DISCORD_BOT_TOKEN` 是否正確
- 確認 Bot 已加入伺服器

### 無法創建語音頻道
- 檢查 Bot 是否有管理頻道權限
- 確認「語音頻道」分類是否存在

### PeiPlay 整合失敗
- 檢查 `PEIPLAY_API_URL` 是否正確
- 確認 PeiPlay 服務是否正常運行
- 使用 `/peiplay_status` 指令檢查連接狀態

## 開發說明

### 新增功能
1. 在 `peiplay_discord_bot.py` 中新增指令
2. 更新 `PeiPlayAPI` 類別以支援新功能
3. 測試功能並更新文件

### 自訂動物名稱
修改 `ANIMALS` 列表來新增或修改動物名稱：
```python
ANIMALS = ["🦊 狐狸", "🐱 貓咪", "🐶 小狗", ...]
```

### 調整時間設定
修改 `TW_TZ` 來調整時區：
```python
TW_TZ = timezone(timedelta(hours=8))  # 台灣時區
``` 