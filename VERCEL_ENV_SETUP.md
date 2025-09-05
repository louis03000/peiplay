# 🚀 Vercel 環境變數設定指南

## ❌ 問題診斷

您遇到的錯誤：
```
Can't reach database server at `aws-0-ap-southeast-1.pooler.supabase.com:5432`
```

這是因為 Vercel 部署環境缺少必要的環境變數設定。

## ✅ 解決方案

### 步驟 1: 登入 Vercel Dashboard

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到您的 `peiplay` 專案
3. 點擊專案進入設定頁面

### 步驟 2: 設定環境變數

1. 點擊 **Settings** 標籤
2. 點擊 **Environment Variables** 左側選單
3. 添加以下環境變數：

#### 必要環境變數：

```bash
# 資料庫連線
DATABASE_URL = postgresql://postgres.hxxqhdsrnjwqyignfrdy:peiplay2025sss920427@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

# NextAuth 設定
NEXTAUTH_SECRET = your-nextauth-secret-here
NEXTAUTH_URL = https://peiplay.vercel.app
```

#### 可選環境變數：

```bash
# Email 設定
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your-email@gmail.com
SMTP_PASS = your-app-password

# Discord Webhook
DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/your-webhook-url

# ECPay 設定
ECPAY_MERCHANT_ID = your-merchant-id
ECPAY_HASH_KEY = your-hash-key
ECPAY_HASH_IV = your-hash-iv
ECPAY_RETURN_URL = https://peiplay.vercel.app/api/payment/callback
ECPAY_ORDER_RESULT_URL = https://peiplay.vercel.app/api/payment/callback
```

### 步驟 3: 重新部署

1. 設定完環境變數後
2. 前往 **Deployments** 標籤
3. 點擊最新部署右側的 **...** 選單
4. 選擇 **Redeploy**

## 🔧 快速修復

如果您需要立即修復，可以：

1. **使用測試金幣功能**：
   - 訪問：`https://peiplay.vercel.app/admin/add-coins`
   - 點擊「添加 1000 金幣」按鈕
   - 這會繞過儲值流程直接添加金幣

2. **檢查環境變數**：
   - 確認 `DATABASE_URL` 已正確設定
   - 確認 `NEXTAUTH_SECRET` 已設定
   - 確認 `NEXTAUTH_URL` 指向正確的域名

## 📋 環境變數檢查清單

- [ ] `DATABASE_URL` - Supabase 資料庫連線字串
- [ ] `NEXTAUTH_SECRET` - NextAuth 加密密鑰
- [ ] `NEXTAUTH_URL` - 應用程式網址
- [ ] `SMTP_HOST` - Email 伺服器（可選）
- [ ] `SMTP_USER` - Email 帳號（可選）
- [ ] `SMTP_PASS` - Email 密碼（可選）
- [ ] `DISCORD_WEBHOOK_URL` - Discord 通知（可選）
- [ ] `ECPAY_MERCHANT_ID` - 綠界商戶 ID（可選）
- [ ] `ECPAY_HASH_KEY` - 綠界 Hash Key（可選）
- [ ] `ECPAY_HASH_IV` - 綠界 Hash IV（可選）

## 🚨 重要提醒

1. **環境變數設定後需要重新部署**
2. **不要將敏感資訊提交到 Git**
3. **定期更新密碼和密鑰**
4. **測試所有功能是否正常運作**

設定完成後，您的金幣系統和所有功能都應該能正常運作！
