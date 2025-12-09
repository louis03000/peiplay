# 環境變數設定指南

## 📋 概述

PeiPlay 使用環境變數來管理配置。本文檔說明如何設定各種環境變數。

## 🏠 本地開發環境

### 1. 建立 .env 檔案

在專案根目錄建立 `.env` 檔案：

```bash
# 複製範例檔案
cp .env.example .env

# 或手動建立
touch .env
```

### 2. 設定必要的環境變數

編輯 `.env` 檔案，填入以下變數：

```env
# 資料庫（必須）
DATABASE_URL=postgresql://user:password@localhost:5432/peiplay

# NextAuth（必須）
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3004

# Redis（可選，但建議設定）
REDIS_URL=redis://localhost:6379
```

### 3. Redis 設定

#### 本地開發（使用 Docker）

```bash
# 啟動 Redis
docker run -d -p 6379:6379 redis:alpine

# 或在 .env 中設定
REDIS_URL=redis://localhost:6379
```

#### 使用 Upstash Redis（推薦用於生產環境）

1. 前往 [Upstash Console](https://console.upstash.com/)
2. 建立 Redis 資料庫
3. 複製連接字串
4. 在 `.env` 中設定：

```env
REDIS_URL=rediss://default:your-token@your-redis.upstash.io:6379
```

## ☁️ Vercel 部署環境

### 1. 登入 Vercel Dashboard

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案

### 2. 設定環境變數

1. 點擊 **Settings** 標籤
2. 點擊 **Environment Variables** 左側選單
3. 添加以下環境變數：

#### 必要變數

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-domain.vercel.app
```

#### Redis 設定（可選但建議）

```bash
# 使用 Upstash Redis（推薦）
REDIS_URL=rediss://default:token@redis.upstash.io:6379
```

### 3. 環境變數範圍

- **Production**：生產環境
- **Preview**：預覽環境（PR 部署）
- **Development**：開發環境

建議為每個環境設定對應的值。

## 🔐 安全注意事項

### 1. 不要提交 .env 到 Git

`.env` 檔案應該已經在 `.gitignore` 中，確認包含：

```
.env
.env.local
.env*.local
```

### 2. 生成安全的密鑰

```bash
# 生成 NEXTAUTH_SECRET
openssl rand -base64 32

# 生成 ENCRYPTION_KEY（32 bytes hex）
openssl rand -hex 32
```

### 3. 敏感資料加密

如果使用敏感資料加密功能，需要設定：

```env
ENCRYPTION_KEY=your-32-byte-hex-key
HASH_PEPPER=your-pepper-string
```

## 📝 環境變數清單

### 必要變數

| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| `DATABASE_URL` | PostgreSQL 資料庫連接字串 | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | NextAuth.js 密鑰 | 使用 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | 應用程式 URL | `http://localhost:3004` 或 `https://your-domain.com` |

### 可選變數

| 變數名稱 | 說明 | 預設值 |
|---------|------|--------|
| `REDIS_URL` | Redis 連接字串 | 無（cache 將被禁用） |
| `ENCRYPTION_KEY` | 敏感資料加密金鑰 | 無 |
| `HASH_PEPPER` | 敏感資料雜湊 Pepper | 無 |
| `SMTP_HOST` | SMTP 伺服器 | 無 |
| `SMTP_PORT` | SMTP 端口 | `587` |
| `SMTP_USER` | SMTP 用戶名 | 無 |
| `SMTP_PASS` | SMTP 密碼 | 無 |
| `DISCORD_BOT_TOKEN` | Discord Bot Token | 無 |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO 伺服器 URL | `http://localhost:5000` |

## ✅ 驗證設定

### 檢查環境變數是否載入

建立測試 API route：

```typescript
// app/api/test-env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasDatabase: !!process.env.DATABASE_URL,
    hasRedis: !!process.env.REDIS_URL,
    hasNextAuth: !!process.env.NEXTAUTH_SECRET,
  });
}
```

訪問 `http://localhost:3004/api/test-env` 檢查。

## 🐛 常見問題

### 1. Redis 連線失敗

**問題**：`REDIS_URL not set, cache will be disabled`

**解決**：
- 確認 `.env` 檔案中有 `REDIS_URL`
- 確認 Redis 服務正在運行
- 檢查連接字串格式是否正確

### 2. 環境變數未生效

**問題**：修改 `.env` 後變數未更新

**解決**：
- 重啟開發伺服器（`npm run dev`）
- 確認 `.env` 檔案在專案根目錄
- 確認變數名稱拼寫正確

### 3. Vercel 環境變數未生效

**問題**：Vercel 部署後環境變數未生效

**解決**：
- 確認環境變數設定在正確的環境（Production/Preview）
- 重新部署應用
- 檢查變數名稱是否正確

## 📚 相關文件

- [Vercel 環境變數設定](./VERCEL_ENV_SETUP.md)
- [Redis Cache 策略](./REDIS_CACHE_STRATEGY.md)
- [部署指南](./DEPLOYMENT.md)

