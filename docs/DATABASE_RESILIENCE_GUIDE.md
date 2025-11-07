# 📘 資料庫彈性處理指南

本指南說明如何使用 PeiPlay 的資料庫彈性處理系統，以改善資料庫連接穩定性。

## 🎯 解決的問題

1. **間歇性連接失敗** - 自動重試機制
2. **連接池耗盡** - 優化的連接池配置
3. **雪崩效應** - 斷路器模式防止級聯故障
4. **Vercel Serverless 冷啟動** - 連接預熱和優化

## 🏗️ 架構概覽

```
┌─────────────────┐
│   API Route     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  withDatabase   │  ← 重試機制
│     Query       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Circuit Breaker │  ← 防止雪崩
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prisma Client   │  ← 優化的連接池
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Database     │
└─────────────────┘
```

## 🚀 快速開始

### 1. 在 API 路由中使用

**之前的寫法：**
```typescript
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const data = await prisma.user.findMany()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}
```

**推薦的新寫法：**
```typescript
import { createErrorResponse, withDatabaseQuery } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const data = await withDatabaseQuery(
      async () => await prisma.user.findMany(),
      'Get users' // 操作名稱（可選，用於日誌）
    )
    return NextResponse.json(data)
  } catch (error) {
    return createErrorResponse(error, 'GET /api/users')
  }
}
```

### 2. 處理複雜的資料庫操作

```typescript
import { withDatabaseQuery } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const result = await withDatabaseQuery(async () => {
      // 在這裡執行所有資料庫操作
      const user = await prisma.user.create({
        data: { email: body.email }
      })
      
      await prisma.profile.create({
        data: { userId: user.id, name: body.name }
      })
      
      return user
    }, 'Create user with profile')
    
    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, 'POST /api/users')
  }
}
```

### 3. 使用事務

```typescript
import { db } from '@/lib/db-resilience'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const results = await db.transaction([
      (prisma) => prisma.user.create({ data: { email: 'test@example.com' } }),
      (prisma) => prisma.profile.create({ data: { userId: 1, name: 'Test' } }),
    ], 'User registration transaction')
    
    return NextResponse.json(results)
  } catch (error) {
    return createErrorResponse(error, 'POST /api/register')
  }
}
```

## ⚙️ 配置說明

### 重試機制配置

位於 `lib/db-resilience.ts`:

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,           // 最大重試 3 次
  initialDelay: 500,        // 首次重試延遲 500ms
  maxDelay: 5000,           // 最大延遲 5 秒
  backoffMultiplier: 2,     // 指數退避倍數
}
```

**重試時序：**
- 第 1 次失敗：等待 500ms
- 第 2 次失敗：等待 1000ms
- 第 3 次失敗：拋出錯誤

### 斷路器配置

```typescript
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,      // 連續 5 次失敗後打開斷路器
  successThreshold: 2,      // 成功 2 次後關閉斷路器
  timeout: 30000,           // 查詢超時 30 秒
  resetTimeout: 60000,      // 斷路器打開後 60 秒嘗試恢復
}
```

**斷路器狀態：**
- ✅ **CLOSED** (關閉) - 正常運作
- 🔴 **OPEN** (打開) - 拒絕所有請求（避免雪崩）
- 🟡 **HALF_OPEN** (半開) - 嘗試恢復

### 連接池配置

位於 `lib/prisma.ts`，自動根據環境調整：

**Vercel 環境：**
```typescript
connection_limit: 3-5      // 較小的連接數
pool_timeout: 30          // 較長的超時
connect_timeout: 15       // 較長的連接超時
```

**本地環境：**
```typescript
connection_limit: 5-10
pool_timeout: 20
connect_timeout: 10
```

## 🔍 監控和診斷

### 1. 健康檢查 API

訪問 `/api/health/database` 查看資料庫狀態：

```json
{
  "status": "healthy",
  "database": {
    "responseTime": 45,
    "responsive": true
  },
  "circuitBreaker": {
    "state": "CLOSED",
    "failureCount": 0,
    "lastFailureTime": null
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### 2. 查看日誌

所有資料庫操作都會記錄詳細的日誌：

```
✅ partners/withdrawal/stats GET api triggered
🔐 Session check: { hasSession: true, userId: 'xxx' }
🔍 查詢夥伴資料...
✅ Query succeeded on attempt 1
```

如果發生重試：
```
❌ Query failed (attempt 1/3): Connection timeout
⏳ Retrying Query in 500ms...
✅ Query succeeded on attempt 2
```

### 3. 手動檢查斷路器狀態

```typescript
import { db } from '@/lib/db-resilience'

const status = db.getCircuitBreakerStatus()
console.log('Circuit breaker:', status)
```

## 🛠️ 故障排除

### 問題：仍然出現 500/503 錯誤

**可能原因：**
1. 資料庫本身宕機
2. 網路問題
3. 連接池配置不當
4. Supabase 免費層限制

**解決方案：**
1. 檢查健康檢查 API：`/api/health/database`
2. 查看伺服器日誌
3. 確認使用 Supabase Pooler URL
4. 考慮升級資料庫方案

### 問題：Circuit breaker 頻繁打開

**檢查：**
```bash
# 查看日誌中的錯誤模式
🚨 Circuit breaker opened - too many failures (5)
```

**解決方案：**
1. 檢查資料庫負載
2. 優化慢查詢
3. 增加 `failureThreshold`
4. 檢查網路連接

### 問題：連接池耗盡

**錯誤訊息：**
```
P1017: Connection pool timeout
P2024: Timed out fetching a new connection
```

**解決方案：**
1. 使用 Supabase Pooler URL
2. 減少 `connection_limit`
3. 增加 `pool_timeout`
4. 檢查是否有連接洩漏

## 📊 性能優化建議

### 1. 使用並行查詢

```typescript
// ❌ 串行查詢（慢）
const users = await prisma.user.findMany()
const posts = await prisma.post.findMany()

// ✅ 並行查詢（快）
const [users, posts] = await Promise.all([
  prisma.user.findMany(),
  prisma.post.findMany()
])
```

### 2. 選擇必要的欄位

```typescript
// ❌ 查詢所有欄位
const user = await prisma.user.findUnique({ where: { id: 1 } })

// ✅ 只查詢需要的欄位
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: { id: true, email: true, name: true }
})
```

### 3. 使用索引

確保在 `schema.prisma` 中為常用查詢添加索引：

```prisma
model Booking {
  id        String   @id @default(cuid())
  partnerId String
  status    String
  
  @@index([partnerId, status])  // 複合索引
}
```

## 🌐 Supabase 特別說明

### 使用 Pooler URL（強烈建議）

1. 前往 Supabase Dashboard
2. Settings → Database → Connection Pooling
3. 複製 "Connection string" (Pooler mode)
4. 更新 Vercel 環境變數 `DATABASE_URL`

**格式：**
```
postgresql://postgres.xxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### 免費層限制

- 直連模式：最多 60 個連接
- Pooler 模式：最多 200 個連接
- 建議使用 Pooler 模式

## 📝 最佳實踐總結

✅ **DO:**
- 始終使用 `withDatabaseQuery` 包裝資料庫操作
- 使用 `createErrorResponse` 統一錯誤處理
- 使用 Supabase Pooler URL
- 並行執行獨立的資料庫查詢
- 選擇必要的欄位
- 定期檢查 `/api/health/database`

❌ **DON'T:**
- 直接調用 `prisma` 而不包裝
- 忽略錯誤日誌
- 在 Vercel 使用直連模式
- 串行執行可並行的查詢
- 查詢不需要的大量數據

## 🔗 相關文件

- `lib/db-resilience.ts` - 彈性處理核心
- `lib/api-helpers.ts` - API 輔助工具
- `lib/prisma.ts` - Prisma 客戶端配置
- `DATABASE_TROUBLESHOOTING.md` - 故障排除指南

## 🆘 需要幫助？

如果問題仍未解決：

1. 檢查 Vercel 部署日誌
2. 檢查 Supabase 日誌
3. 查看 `/api/health/database` 狀態
4. 聯繫技術支援團隊

