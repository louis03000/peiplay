# Vercel 環境變數設定指南（Discord OAuth2）

## 快速設定步驟

### 1. 獲取 Discord OAuth2 資訊

在 Discord Developer Portal 的 OAuth2 頁面：

1. **Client ID**：直接複製（例如：`1382291813519331379`）
2. **Client Secret**：點擊 "Reset Secret" → 複製新的 Secret（只顯示一次！）

### 2. 在 Vercel 設定環境變數

1. 前往 https://vercel.com/dashboard
2. 選擇 **PeiPlay** 專案
3. 點擊 **Settings** → **Environment Variables**
4. 添加以下變數：

#### 必須添加的變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `DISCORD_CLIENT_ID` | `1382291813519331379` | 從 Discord Developer Portal 複製 |
| `DISCORD_CLIENT_SECRET` | `你重置後的_secret` | 點擊 Reset Secret 後複製（只顯示一次） |

#### 如果還沒有的變數（檢查是否已存在）：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `DISCORD_BOT_TOKEN` | `你的_bot_token` | 與 Discord Bot 的 .env 相同 |
| `DISCORD_GUILD_ID` | `976829566490386502` | 與 Discord Bot 的 .env 相同 |
| `NEXTAUTH_URL` | `https://peiplay.vercel.app` | 你的網站 URL |

#### 可選變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `DISCORD_REDIRECT_URI` | `https://peiplay.vercel.app/api/discord/callback` | 如果不設定會自動生成 |

### 3. 設定完成後

1. 點擊 **Save** 保存所有環境變數
2. Vercel 會自動重新部署
3. 等待部署完成後測試功能

## 重要提醒

⚠️ **Client Secret 只顯示一次**

當你點擊 "Reset Secret" 後：
1. 立即複製新的 Secret
2. 立即在 Vercel 中設定
3. 不要關閉頁面，直到確認已保存

⚠️ **兩個不同的配置位置**

- **Discord Bot 的 .env**（`E:\python.12\discord-bot\.env`）：用於 Python Bot
- **Vercel 環境變數**：用於 Next.js 網站的 OAuth2 功能

兩者需要設定相同的 `DISCORD_BOT_TOKEN` 和 `DISCORD_GUILD_ID`，但 OAuth2 的 `CLIENT_ID` 和 `CLIENT_SECRET` 只在 Vercel 中設定。

## 驗證設定

設定完成後，可以測試：

1. 完成註冊流程
2. 驗證 Email
3. 在驗證成功頁面，應該會看到「加入 PeiPlay Discord 伺服器」按鈕
4. 點擊按鈕應該會跳轉到 Discord 授權頁面

如果按鈕沒有出現，檢查：
- `DISCORD_CLIENT_ID` 是否正確設定
- 用戶是否已登入（需要 session）
