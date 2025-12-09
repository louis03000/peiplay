# Redis 環境變數設定指南

## 📍 REDIS_URL 設定位置

### 1. 本地開發環境

在專案根目錄的 `.env` 檔案中添加：

```env
REDIS_URL=redis://localhost:6379
```

**完整 .env 範例：**
```env
# 資料庫
DATABASE_URL=postgresql://user:password@localhost:5432/peiplay

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3004

# Redis（新增這行）
REDIS_URL=redis://localhost:6379
```

### 2. Vercel 部署環境

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 點擊 **Settings** → **Environment Variables**
4. 添加新變數：
   - **Name**: `REDIS_URL`
   - **Value**: `redis://localhost:6379`（本地）或 Upstash Redis URL（生產環境）
   - **Environment**: 選擇 Production / Preview / Development

### 3. 使用 Upstash Redis（生產環境推薦）

1. 前往 [Upstash Console](https://console.upstash.com/)
2. 建立 Redis 資料庫
3. 複製連接字串（格式類似：`rediss://default:token@redis.upstash.io:6379`）
4. 在 Vercel 環境變數中設定

## ✅ 驗證設定

### 檢查 Redis 連線

建立測試 API：

```typescript
// app/api/test-redis/route.ts
import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis-cache';

export async function GET() {
  const client = getRedisClient();
  
  if (!client) {
    return NextResponse.json({
      status: 'disabled',
      message: 'Redis not configured or not installed',
      redisUrl: process.env.REDIS_URL || 'not set',
    });
  }

  try {
    await client.ping();
    return NextResponse.json({
      status: 'connected',
      message: 'Redis is working',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
```

訪問 `http://localhost:3004/api/test-redis` 檢查連線狀態。

## 🐛 常見問題

### 問題 1: Redis 連線失敗

**錯誤訊息：** `REDIS_URL not set, cache will be disabled`

**解決方法：**
1. 確認 `.env` 檔案在專案根目錄
2. 確認 `REDIS_URL` 變數名稱正確（全大寫）
3. 重啟開發伺服器（`npm run dev`）

### 問題 2: Redis 服務未啟動

**錯誤訊息：** `ECONNREFUSED` 或連線超時

**解決方法：**
```bash
# 使用 Docker 啟動 Redis
docker run -d -p 6379:6379 redis:alpine

# 或使用本地安裝的 Redis
redis-server
```

### 問題 3: Vercel 環境變數未生效

**解決方法：**
1. 確認環境變數設定在正確的環境（Production/Preview）
2. 重新部署應用
3. 檢查變數名稱是否正確

## 📝 注意事項

1. **不要提交 .env 到 Git**：`.env` 應該在 `.gitignore` 中
2. **生產環境使用 Upstash**：本地 Redis 不適合生產環境
3. **Redis 是可選的**：如果未設定，應用程式仍可正常運作，只是沒有 cache

## 🔗 相關文件

- [環境變數設定指南](./ENV_SETUP.md)
- [Redis Cache 策略](./REDIS_CACHE_STRATEGY.md)

