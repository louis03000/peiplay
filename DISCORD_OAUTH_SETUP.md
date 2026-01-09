# Discord OAuth2 一鍵加入伺服器設定指南

## 概述

本功能允許用戶在註冊並驗證 Email 後，一鍵授權加入 PeiPlay Discord 伺服器。這符合 Discord 官方規則，使用 OAuth2 流程。

## 設定步驟

### 1. 在 Discord Developer Portal 設定 OAuth2

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 選擇你的應用程式（或創建新的）
3. 進入 **OAuth2** 頁面
4. 點擊 **URL Generator**

### 2. 設定 OAuth2 Scopes

在 URL Generator 中，勾選以下 scopes：

- ✅ **bot** - Bot 權限
- ✅ **guilds.join** - 將用戶加入伺服器（關鍵！）

### 3. 設定 Bot 權限（可選，基本即可）

在 Bot Permissions 中，至少需要：
- `Send Messages`
- `Manage Channels`
- `Move Members`

### 4. 設定 Redirect URI

1. 在 OAuth2 頁面的 **Redirects** 區塊
2. 點擊 **Add Redirect**
3. 添加以下 URL：
   ```
   https://peiplay.vercel.app/api/discord/callback
   ```
   如果是本地開發：
   ```
   http://localhost:3000/api/discord/callback
   ```

### 5. 獲取必要的資訊

在 OAuth2 頁面，你會看到：

- **Client ID** - 這是你的 `DISCORD_CLIENT_ID`（直接複製即可，例如：`1382291813519331379`）
- **Client Secret** - 點擊 "Reset Secret" 獲取，這是你的 `DISCORD_CLIENT_SECRET`

⚠️ **關於 Reset Secret**：
- 如果這是**第一次設定 OAuth2**，可以安全地點擊 "Reset Secret" 獲取新的 Secret
- **重要**：Secret 只顯示一次，請立即複製並保存
- 重置後，舊的 Secret 會立即失效，所以必須立即更新到 Vercel 環境變數

### 6. 設定環境變數

⚠️ **重要：有兩個地方需要設定環境變數**

#### A. Discord Bot 的環境變數（Python Bot，在 `E:\python.12\discord-bot\.env`）

這個你已經有了，包含：
```env
DISCORD_BOT_TOKEN=你的_bot_token
DISCORD_GUILD_ID=你的伺服器_id
ADMIN_CHANNEL_ID=你的管理員頻道_id
POSTGRES_CONN=你的資料庫連接
CHECK_INTERVAL=30
```

#### B. Next.js/Vercel 的環境變數（用於 OAuth2 功能）

**這需要在 Vercel 環境變數中設定**（不是 Discord Bot 的 .env）：

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的專案（PeiPlay）
3. 進入 **Settings** → **Environment Variables**
4. 添加以下變數：

```env
# Discord OAuth2 設定（新增）
DISCORD_CLIENT_ID=你的_client_id（從 Discord Developer Portal 複製）
DISCORD_CLIENT_SECRET=你的_client_secret（點擊 Reset Secret 後複製）

# Discord Bot 設定（如果還沒有，需要添加）
DISCORD_BOT_TOKEN=你的_bot_token（與 Discord Bot 的 .env 相同）
DISCORD_GUILD_ID=你的伺服器_id（與 Discord Bot 的 .env 相同）

# Redirect URI（可選，如果不設定會使用預設值）
DISCORD_REDIRECT_URI=https://peiplay.vercel.app/api/discord/callback

# NextAuth URL（應該已經有了）
NEXTAUTH_URL=https://peiplay.vercel.app
```

**注意**：
- `DISCORD_BOT_TOKEN` 和 `DISCORD_GUILD_ID` 可以與 Discord Bot 的 .env 相同
- 但 `DISCORD_CLIENT_ID` 和 `DISCORD_CLIENT_SECRET` 是 OAuth2 專用的，需要從 Discord Developer Portal 獲取

## 流程說明

### 用戶體驗流程

1. 用戶完成註冊
2. 用戶驗證 Email
3. 在驗證成功頁面，看到「加入 PeiPlay Discord 伺服器」按鈕
4. 點擊按鈕 → 跳轉到 Discord 授權頁面
5. 用戶點擊「授權」→ 自動加入伺服器
6. 跳轉回 PeiPlay，顯示成功訊息

### 技術流程

1. **前端**：調用 `/api/discord/oauth-url` 獲取 OAuth URL
2. **前端**：用戶點擊按鈕，跳轉到 Discord 授權頁面
3. **Discord**：用戶授權後，重定向到 `/api/discord/callback?code=XXX&state=YYY`
4. **後端**：用 `code` 換取 `access_token`
5. **後端**：用 `access_token` 獲取用戶 Discord ID
6. **後端**：用 Bot Token 將用戶加入伺服器
7. **後端**：重定向到成功/失敗頁面

## API 端點

### GET `/api/discord/oauth-url`

獲取 Discord OAuth2 授權 URL。

**權限**：需要登入

**回應**：
```json
{
  "oauthUrl": "https://discord.com/oauth2/authorize?..."
}
```

### GET `/api/discord/callback`

Discord OAuth2 回調處理。

**參數**：
- `code` - Discord 返回的授權碼
- `state` - 用戶 ID（用於驗證）

**流程**：
1. 用 `code` 換取 `access_token`
2. 用 `access_token` 獲取用戶 Discord ID
3. 用 Bot Token 將用戶加入伺服器
4. 重定向到成功/失敗頁面

## 頁面

### `/auth/discord-success`

顯示成功加入 Discord 伺服器的訊息。

**查詢參數**：
- `already_member=true` - 如果用戶已經在伺服器中

### `/auth/discord-error`

顯示加入失敗的錯誤訊息。

**查詢參數**：
- `error` - 錯誤代碼

## 錯誤處理

常見錯誤代碼：

- `access_denied` - 用戶取消了授權
- `missing_params` - 缺少必要的參數
- `config_missing` - Discord 配置缺失
- `token_failed` - 獲取 access_token 失敗
- `no_token` - 未獲取到授權令牌
- `user_info_failed` - 獲取用戶資訊失敗
- `join_failed` - 加入伺服器失敗

## 注意事項

1. **安全性**：
   - `DISCORD_CLIENT_SECRET` 必須保密，不要提交到 Git
   - 使用環境變數存儲敏感資訊

2. **Redirect URI**：
   - 必須在 Discord Developer Portal 中正確設定
   - 本地開發和生產環境需要分別設定

3. **Bot 權限**：
   - Bot 必須已經加入目標伺服器
   - Bot 需要有 `guilds.join` 權限

4. **用戶體驗**：
   - 如果用戶已經在伺服器中，會顯示友好訊息
   - 如果用戶取消授權，會顯示相應提示

## 測試

1. 完成註冊流程
2. 驗證 Email
3. 在驗證成功頁面，點擊「加入 PeiPlay Discord 伺服器」按鈕
4. 確認跳轉到 Discord 授權頁面
5. 點擊「授權」
6. 確認成功加入伺服器並顯示成功訊息

## 故障排除

### 問題：無法獲取 OAuth URL

**檢查**：
- `DISCORD_CLIENT_ID` 是否正確設定
- 用戶是否已登入

### 問題：回調失敗

**檢查**：
- `DISCORD_CLIENT_SECRET` 是否正確
- Redirect URI 是否在 Discord Developer Portal 中正確設定
- `DISCORD_BOT_TOKEN` 是否有效
- `DISCORD_GUILD_ID` 是否正確

### 問題：無法加入伺服器

**檢查**：
- Bot 是否已經加入目標伺服器
- Bot 是否有 `guilds.join` 權限
- 用戶是否已經在伺服器中（這不算錯誤）
