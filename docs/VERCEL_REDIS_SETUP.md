# Vercel Redis 設定指南（Git 部署）

## 🎯 概述

如果您是直接 git push 到 Vercel 部署，不需要設定本地環境變數。所有設定都在 Vercel Dashboard 完成。

## 📍 步驟 1：設定 REDIS_URL 環境變數

### 1.1 登入 Vercel Dashboard

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到您的 `peiplay` 專案
3. 點擊專案進入設定頁面

### 1.2 添加環境變數

1. 點擊 **Settings** 標籤
2. 點擊左側選單的 **Environment Variables**
3. 點擊 **Add New** 按鈕

### 1.3 設定 REDIS_URL

**選項 A：使用 Upstash Redis（推薦）**

1. 前往 [Upstash Console](https://console.upstash.com/)
2. 點擊 **Create Database**
3. 選擇 **Redis** 類型
4. 選擇區域（建議選擇與 Vercel 相同的區域）
5. 點擊 **Create**
6. 複製 **REST URL** 或 **Redis URL**
   - 格式類似：`rediss://default:token@redis-xxx.upstash.io:6379`
7. 在 Vercel 中添加：
   - **Name**: `REDIS_URL`
   - **Value**: 貼上複製的 Redis URL
   - **Environment**: 選擇 **Production**、**Preview**、**Development**（或全部）

**選項 B：使用其他 Redis 服務**

如果您有其他 Redis 服務（如 AWS ElastiCache、Redis Cloud 等），直接貼上連接字串即可。

### 1.4 確認其他必要環境變數

確保以下環境變數都已設定：

```bash
# 必要變數
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-domain.vercel.app

# Redis（新增）
REDIS_URL=rediss://default:token@redis.upstash.io:6379
```

## 🔄 步驟 2：重新部署

設定環境變數後，需要重新部署才能生效：

1. 在 Vercel Dashboard 中，點擊 **Deployments** 標籤
2. 找到最新的部署
3. 點擊右側的 **...** 選單
4. 選擇 **Redeploy**
5. 或直接 push 一個新的 commit 觸發自動部署

## ✅ 步驟 3：驗證設定

### 方法 1：檢查部署日誌

1. 在 Vercel Dashboard 中查看部署日誌
2. 搜尋 "Redis" 相關訊息
3. 如果看到 "✅ Redis connected" 表示成功

### 方法 2：建立測試 API

在您的專案中建立測試 API：

```typescript
// app/api/test-redis/route.ts
import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis-cache';

export async function GET() {
  const hasRedisUrl = !!process.env.REDIS_URL;
  const client = getRedisClient();
  
  if (!hasRedisUrl) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'REDIS_URL environment variable not set',
    });
  }

  if (!client) {
    return NextResponse.json({
      status: 'not_connected',
      message: 'Redis client not available (may be disabled)',
    });
  }

  try {
    await client.ping();
    return NextResponse.json({
      status: 'connected',
      message: 'Redis is working correctly',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
```

部署後訪問：`https://your-domain.vercel.app/api/test-redis`

## 🎯 重要提醒

### 1. 環境變數範圍

Vercel 有三種環境：
- **Production**：生產環境（主分支部署）
- **Preview**：預覽環境（PR 或分支部署）
- **Development**：開發環境（本地 `vercel dev`）

建議為所有環境設定相同的 Redis URL。

### 2. 免費方案限制

- **Upstash Free Tier**：
  - 10,000 命令/天
  - 256 MB 儲存空間
  - 足夠小型應用使用

### 3. 安全性

- Redis URL 包含認證資訊，不要提交到 Git
- Vercel 環境變數是加密儲存的
- 使用 `rediss://`（SSL）連接更安全

## 🐛 常見問題

### 問題 1：環境變數設定後未生效

**解決方法：**
- 確認已重新部署
- 確認環境變數名稱正確（`REDIS_URL`，全大寫）
- 檢查環境變數的範圍設定（Production/Preview）

### 問題 2：Redis 連線失敗

**錯誤訊息：** `ECONNREFUSED` 或 `ETIMEDOUT`

**解決方法：**
- 確認 Redis URL 格式正確
- 確認 Upstash Redis 資料庫已啟動
- 檢查防火牆設定（Upstash 應該允許所有 IP）

### 問題 3：本地開發需要 Redis 嗎？

**答案：** 不需要！

- 如果未設定 `REDIS_URL`，Redis cache 會自動禁用
- 應用程式仍可正常運作，只是沒有 cache
- 如果需要本地測試 Redis，可以：
  1. 使用 Docker：`docker run -d -p 6379:6379 redis:alpine`
  2. 或在本地 `.env` 設定 `REDIS_URL=redis://localhost:6379`

## 📚 相關文件

- [Vercel 環境變數設定](./VERCEL_ENV_SETUP.md)
- [Redis Cache 策略](./REDIS_CACHE_STRATEGY.md)
- [環境變數設定指南](./ENV_SETUP.md)

## 🚀 快速檢查清單

- [ ] 在 Upstash 建立 Redis 資料庫
- [ ] 複製 Redis URL
- [ ] 在 Vercel Dashboard 添加 `REDIS_URL` 環境變數
- [ ] 設定環境範圍（Production/Preview/Development）
- [ ] 重新部署應用
- [ ] 測試 Redis 連線（使用 `/api/test-redis`）

完成以上步驟後，Redis cache 就會在 Vercel 部署中正常運作！

