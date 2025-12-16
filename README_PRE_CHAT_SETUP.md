# 🚀 預聊系統快速設定指南

## 快速開始（5 分鐘）

### 1. 執行資料庫 Migration

在 Supabase Dashboard 執行 SQL：

```sql
-- 複製 prisma/migrations/create_pre_chat_system.sql 的內容
-- 在 Supabase SQL Editor 中執行
```

### 2. 生成 Prisma Client

```bash
npx prisma generate
```

### 3. 設定 GitHub Actions（推薦）

#### 3.1 生成 CRON_SECRET

```bash
openssl rand -hex 32
```

**複製這個值，接下來兩個地方都需要用到！**

#### 3.2 設定 GitHub Secrets（在 GitHub 設定）

**📍 位置：GitHub Repository**

1. 前往你的 GitHub Repository
2. 點擊 **Settings** → **Secrets and variables** → **Actions**
3. 點擊 **New repository secret**
4. 添加以下 secrets：
   - `CRON_SECRET`: 貼上剛才生成的隨機字串
   - `API_URL`: 你的 Vercel 網址（例如：`https://your-app.vercel.app`）

#### 3.3 設定環境變數（在 Vercel 設定）

**📍 位置：Vercel Dashboard**

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的專案
3. 點擊 **Settings** → **Environment Variables**
4. 添加環境變數：
   - Key: `CRON_SECRET`
   - Value: **貼上與 GitHub Secrets 中相同的值**（必須完全相同！）
   - Environment: 選擇所有環境（Production, Preview, Development）
5. 點擊 **Save**
6. **重要：** 重新部署專案（或等待下次自動部署）

#### 3.4 驗證

前往 GitHub Actions 頁面，手動觸發一次 workflow，確認執行成功。

### 4. 測試

1. 從陪玩師卡片點擊「聊天」按鈕
2. 發送幾則訊息
3. 確認訊息正常顯示
4. 測試訊息過濾（嘗試發送包含 URL 的訊息）

## 📚 詳細文檔

- [預聊系統完整說明](./docs/PRE_CHAT_SYSTEM.md)
- [效能優化詳情](./docs/PRE_CHAT_OPTIMIZATION.md)
- [GitHub Actions 設定指南](./docs/GITHUB_ACTIONS_SETUP.md)
- [Cursor AI 修復指令](./docs/CURSOR_AI_FIX_INSTRUCTIONS.md)
- [Session 優化建議](./docs/SESSION_OPTIMIZATION.md)

## ✅ 檢查清單

- [ ] 資料庫 migration 已執行
- [ ] Prisma Client 已生成
- [ ] GitHub Secrets 已設定
- [ ] 環境變數已設定
- [ ] GitHub Actions workflow 執行成功
- [ ] 前端聊天功能測試通過
- [ ] 訊息過濾功能測試通過

## 🆘 遇到問題？

查看 [故障排除指南](./docs/PRE_CHAT_SYSTEM.md#故障排除)

