# 📧 Email 通知功能設置指南

## 功能概述

PeiPlay 系統現在支援自動 email 通知功能，包括：

- ✅ **預約創建通知** - 通知夥伴有新預約
- ✅ **頻道創建通知** - 通知顧客頻道已創建
- ✅ **預約取消通知** - 通知相關方預約被取消

## 設置步驟

### 1. 設置 Gmail 應用程式密碼

1. 登入您的 Gmail 帳號
2. 前往 [Google 帳戶設定](https://myaccount.google.com/)
3. 點擊「安全性」→「兩步驟驗證」
4. 啟用兩步驟驗證（如果尚未啟用）
5. 在「應用程式密碼」中生成新的密碼
6. 選擇「郵件」和「其他（自訂名稱）」
7. 輸入「PeiPlay 系統」作為名稱
8. 複製生成的 16 位元密碼

### 2. 設置環境變數

在您的 `.env.local` 文件中添加：

```env
# Email Configuration (Gmail SMTP)
EMAIL_USER="your-gmail@gmail.com"
EMAIL_APP_PASSWORD="your-16-digit-app-password"
```

### 3. 測試 Email 功能

使用測試 API 來驗證 email 設置：

```bash
# 測試預約通知
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "booking", "email": "test@example.com"}'

# 測試頻道創建通知
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "channel", "email": "test@example.com"}'
```

## 通知觸發時機

### 預約創建通知
- **即時預約**: 創建時立即發送給夥伴
- **一般預約**: 創建時立即發送給夥伴

### 頻道創建通知
- **即時預約**: Discord 頻道創建後發送給顧客
- **一般預約**: 夥伴確認後頻道創建時發送給顧客

## Email 模板特色

- 🎨 **美觀設計**: 漸層背景和現代化 UI
- 📱 **響應式**: 支援各種設備查看
- 🌐 **多語言**: 支援繁體中文
- 📊 **詳細資訊**: 包含完整的預約和頻道資訊
- ⚠️ **狀態提示**: 清楚標示預約類型和注意事項

## 故障排除

### 常見問題

1. **"Authentication failed" 錯誤**
   - 確認 Gmail 應用程式密碼正確
   - 確認已啟用兩步驟驗證

2. **"Connection refused" 錯誤**
   - 檢查網路連接
   - 確認 Gmail SMTP 設定正確

3. **Email 沒有收到**
   - 檢查垃圾郵件資料夾
   - 確認 email 地址正確
   - 檢查 Gmail 的收件設定

### 日誌查看

查看控制台日誌來診斷問題：

```bash
# 查看 Next.js 日誌
npm run dev

# 查看 Discord Bot 日誌
cd discord-bot
python bot.py
```

## 成本說明

- **Gmail SMTP**: 完全免費
- **每日限制**: 500 封郵件
- **升級選項**: 如需更多郵件，可考慮 SendGrid 或 Mailgun

## 安全注意事項

- 🔒 使用應用程式密碼而非 Gmail 主密碼
- 🔒 定期更換應用程式密碼
- 🔒 不要在代碼中硬編碼 email 密碼
- 🔒 使用環境變數存儲敏感資訊

## 支援

如有問題，請檢查：
1. 環境變數設置
2. Gmail 應用程式密碼
3. 網路連接
4. 控制台日誌

---

**注意**: 此功能需要正確的環境變數設置才能正常工作。請確保按照上述步驟完成設置。
