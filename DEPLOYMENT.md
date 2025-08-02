# PeiPlay 部署指南

## 專案結構

```
PeiPlay/
├── app/                    # Next.js 前端應用
├── components/             # React 組件
├── discord-bot/           # Discord Bot
│   ├── bot.py             # 主要 Bot 文件
│   ├── requirements.txt   # Python 依賴
│   └── README.md         # Bot 說明文件
├── prisma/               # 資料庫 schema
└── package.json          # 主專案配置
```

## 部署選項

### 1. 免費部署方案（推薦）

#### 前端 (Vercel)
- 免費層級：無限部署
- 自動從 GitHub 部署
- 設置環境變數

#### 資料庫 (Supabase)
- 免費層級：500MB 資料庫
- 設置步驟：
  1. 註冊 [Supabase](https://supabase.com)
  2. 創建新項目
  3. 獲取 DATABASE_URL
  4. 更新 .env 文件

#### Discord Bot (Railway)
- 免費層級：$5 信用額度
- 設置步驟：
  1. 註冊 [Railway](https://railway.app)
  2. 連接 GitHub 倉庫
  3. 設置環境變數
  4. 自動部署

### 2. 環境變數設置

#### 前端 (.env)
```env
DATABASE_URL=your_supabase_url
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=https://your-domain.vercel.app
```

#### Discord Bot (.env)
```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_guild_id
POSTGRES_CONN=your_supabase_url
ADMIN_CHANNEL_ID=your_admin_channel_id
CHECK_INTERVAL=30
```

### 3. 部署步驟

#### 步驟 1：設置 Supabase 資料庫
1. 註冊 Supabase 帳戶
2. 創建新項目
3. 在 SQL Editor 中運行 Prisma schema
4. 獲取連接字串

#### 步驟 2：部署前端到 Vercel
1. 連接 GitHub 倉庫
2. 設置環境變數
3. 自動部署

#### 步驟 3：部署 Discord Bot 到 Railway
1. 連接 GitHub 倉庫
2. 設置環境變數
3. 選擇 discord-bot 目錄
4. 自動部署

### 4. 本地開發

#### 啟動前端
```bash
npm run dev
```

#### 啟動 Discord Bot
```bash
npm run bot:install  # 安裝依賴
npm run bot:dev      # 啟動 Bot
```

### 5. 成本估算

| 服務 | 免費層級 | 付費計劃 |
|------|----------|----------|
| **Vercel** | 免費 | $20/月 |
| **Supabase** | 500MB | $25/月 |
| **Railway** | $5 信用額度 | $5/月 |
| **總計** | **免費** | **$50/月** |

### 6. 故障排除

#### 常見問題
1. **資料庫連接失敗**
   - 檢查 DATABASE_URL 格式
   - 確認 Supabase 項目狀態

2. **Discord Bot 無法啟動**
   - 檢查 Bot Token 是否正確
   - 確認 Bot 權限設置

3. **前端部署失敗**
   - 檢查環境變數設置
   - 確認 Next.js 配置

#### 支援
- 查看各服務的官方文檔
- 檢查 GitHub Issues
- 聯繫技術支援 