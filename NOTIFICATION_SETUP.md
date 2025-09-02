# 🔔 PeiPlay 通知系統設置指南

## 📧 Email 通知設置

### 1. Gmail 設置（推薦）

#### 步驟 1: 啟用 2FA
- 登入 Google 帳戶
- 前往 [安全性設定](https://myaccount.google.com/security)
- 啟用兩步驟驗證

#### 步驟 2: 生成應用程式密碼
- 在安全性設定中找到「應用程式密碼」
- 選擇「郵件」和「其他（自訂名稱）」
- 輸入名稱（例如：PeiPlay）
- 複製生成的 16 位元密碼

#### 步驟 3: 環境變數設置
在 `.env.local` 文件中添加：

```bash
# Email 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-digit-app-password
```

### 2. 其他 SMTP 服務

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

#### Yahoo Mail
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

---

## 🎮 Discord 通知設置

### 1. 創建 Webhook

#### 步驟 1: 選擇頻道
- 在 Discord 伺服器中選擇要發送通知的頻道
- 右鍵點擊頻道 → 編輯頻道

#### 步驟 2: 創建 Webhook
- 點擊「整合」標籤
- 點擊「Webhook」
- 點擊「新增 Webhook」
- 輸入名稱（例如：PeiPlay 通知）
- 複製 Webhook URL

#### 步驟 3: 環境變數設置
在 `.env.local` 文件中添加：

```bash
# Discord Webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

### 2. 測試 Webhook

可以使用以下命令測試 Webhook 是否正常：

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":"🔔 測試通知"}' \
  https://discord.com/api/webhooks/your-webhook-url
```

---

## 🚀 完整環境變數配置

在 `.env.local` 文件中添加以下配置：

```bash
# 資料庫
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Discord Bot
DISCORD_BOT_TOKEN="your-discord-bot-token"
DISCORD_GUILD_ID="your-discord-guild-id"
DISCORD_ADMIN_CHANNEL_ID="your-discord-admin-channel-id"
DISCORD_CHANNEL_CREATION_CHANNEL_ID="your-discord-channel-creation-channel-id"

# Email 通知配置
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Discord Webhook 通知配置
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/your-webhook-url"
DISCORD_ADMIN_CHANNEL_ID="your-discord-admin-channel-id"

# 綠界金流
ECPAY_MERCHANT_ID="your-merchant-id"
ECPAY_HASH_KEY="your-hash-key"
ECPAY_HASH_IV="your-hash-iv"
```

---

## ✅ 測試通知系統

### 1. 測試 Email 通知

創建測試 API 端點：

```typescript
// app/api/test/notification/route.ts
import { sendNotification } from '@/lib/notifications';

export async function POST() {
  const testData = {
    type: 'BOOKING_CREATED' as const,
    bookingId: 'test-123',
    customerEmail: 'test@example.com',
    customerName: '測試顧客',
    partnerEmail: 'partner@example.com',
    partnerName: '測試夥伴',
    scheduleDate: new Date(),
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    amount: 300,
  };

  const result = await sendNotification(testData);
  return Response.json(result);
}
```

### 2. 測試 Discord 通知

使用 Discord Webhook 測試工具或直接調用 API。

---

## 🔧 故障排除

### Email 發送失敗

1. **檢查 SMTP 配置**
   - 確認 SMTP 主機和端口正確
   - 確認用戶名和密碼正確

2. **Gmail 特定問題**
   - 確認已啟用 2FA
   - 確認使用的是應用程式密碼，不是登入密碼
   - 確認已允許「安全性較低的應用程式」

3. **防火牆問題**
   - 確認端口 587 或 465 未被阻擋

### Discord 通知失敗

1. **檢查 Webhook URL**
   - 確認 Webhook URL 正確
   - 確認 Webhook 未被刪除

2. **權限問題**
   - 確認 Bot 有發送訊息的權限
   - 確認頻道權限設置正確

---

## 📱 通知類型

系統支援以下通知類型：

- 🎯 **BOOKING_CREATED**: 新預約通知
- 💳 **PAYMENT_SUCCESS**: 付款成功通知
- ❌ **PAYMENT_FAILED**: 付款失敗通知
- ✅ **PARTNER_CONFIRMATION**: 夥伴確認通知
- ❌ **PARTNER_REJECTION**: 夥伴拒絕通知
- 🚫 **BOOKING_CANCELLED**: 預約取消通知
- ⏰ **BOOKING_REMINDER**: 預約提醒通知
- 🎮 **BOOKING_STARTING**: 預約開始通知
- 🏁 **BOOKING_COMPLETED**: 預約完成通知

---

## 🎉 完成！

設置完成後，系統將自動發送以下通知：

1. **預約創建時**: 通知夥伴有新預約
2. **付款成功時**: 通知顧客付款成功
3. **付款失敗時**: 通知顧客付款失敗
4. **預約取消時**: 通知雙方預約已取消
5. **預約開始前**: 提醒雙方預約即將開始

所有通知都會同時發送到 Email 和 Discord！
