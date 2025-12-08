# 🚀 Peiplay 全面效能優化指南

## 📋 概述

本文件記錄了 Peiplay 專案的全面效能優化方案，目標是將所有頁面載入時間降低到 1 秒以內。

## ✅ 已完成的優化

### 1. 資料庫索引優化

#### 1.1 添加的索引

**Partner 表：**
- `idx_partner_status_available`: `(status, isAvailableNow)` - 常用篩選組合
- `idx_partner_status_rankbooster`: `(status, isRankBooster)` - 排行榜查詢
- `idx_partner_status_created`: `(status, createdAt DESC)` - 列表排序
- `idx_partner_inviteCode`: `(inviteCode)` - 邀請碼查詢

**Schedule 表：**
- `idx_schedule_partner_date_available`: `(partnerId, date, isAvailable)` - 最常用查詢
- `idx_schedule_partner_date_start`: `(partnerId, date, startTime)` - 時段排序
- `idx_schedule_date_time_range`: `(date, startTime, endTime)` - 時間範圍查詢
- `idx_schedule_endTime`: `(endTime)` - 查詢未結束的預約

**Booking 表：**
- `idx_booking_customer_status`: `(customerId, status)` - 用戶預約查詢
- `idx_booking_customer_created`: `(customerId, createdAt DESC)` - 用戶預約列表排序
- `idx_booking_status_created`: `(status, createdAt DESC)` - 狀態查詢 + 排序
- `idx_booking_multiplayer_status`: `(multiPlayerBookingId, status)` - 多人預約查詢
- `idx_booking_groupBookingId`: `(groupBookingId)` - 群組預約查詢

**其他重要索引：**
- `PersonalNotification`: `(userId, isRead, createdAt DESC)` - 通知列表查詢
- `Announcement`: `(isActive, createdAt DESC)` - 公告列表排序
- `Review`: `(revieweeId, isApproved)` - 評價查詢
- `ChatMessage`: `(roomId, createdAt DESC)` - 聊天訊息查詢

#### 1.2 索引建立方式

執行以下 SQL 腳本建立所有索引：

```bash
psql $DATABASE_URL -f scripts/comprehensive_performance_indexes.sql
```

或使用 Prisma migration：

```bash
npx prisma migrate dev --name add_performance_indexes
```

### 2. Prisma 查詢優化

#### 2.1 優化原則

1. **使用 `select` 而非 `include`**
   - ✅ 只查詢必要欄位
   - ❌ 避免載入所有關聯資料

2. **避免 OR 條件**
   - ✅ 先查詢所有資料，然後在應用層過濾
   - ❌ 避免在 where 中使用 OR，會影響索引使用

3. **限制查詢結果**
   - ✅ 使用 `take` 限制結果數量
   - ❌ 避免查詢所有資料

4. **使用索引優化的排序**
   - ✅ 使用有索引的欄位排序
   - ❌ 避免對未索引欄位排序

#### 2.2 優化的 API

**`/api/partners` (GET)**
- ✅ 移除 OR 條件，改為應用層過濾
- ✅ 限制結果為 50 筆
- ✅ 使用 `select` 而非 `include`
- ✅ 優化「現在有空」查詢邏輯

**`/api/partners/search-for-multi-player` (GET)**
- ✅ 移除 `reviewsReceived` include
- ✅ 使用 `select` 限定欄位
- ✅ 限制結果為 100 筆夥伴，每個夥伴最多 100 個時段

**`/api/orders` (GET)**
- ✅ 直接在查詢時限制為 50 筆
- ✅ 移除查詢中的刪除操作（應在背景任務執行）

**`/api/bookings/me` (GET)**
- ✅ 限制結果為 30 筆
- ✅ 移除不必要的 `reviews` include
- ✅ 使用 `select` 限定欄位

**`/api/favorites` (GET)**
- ✅ 使用 raw query 優化 JOIN 查詢
- ✅ 限制結果為 50 筆

**`/api/personal-notifications` (GET)**
- ✅ 批量查詢發送者，避免 JOIN
- ✅ 限制結果為 30 筆
- ✅ 在應用層過濾過期通知

**`/api/announcements` (GET)**
- ✅ 使用 `select` 限定欄位
- ✅ 在應用層過濾過期公告
- ✅ 限制結果為 50 筆

### 3. API 回傳優化

#### 3.1 分頁支援

所有列表 API 都應該支援分頁：

```typescript
// 範例：添加分頁參數
const page = parseInt(searchParams.get('page') || '1')
const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
const skip = (page - 1) * limit

const results = await client.model.findMany({
  take: limit,
  skip: skip,
  // ...
})
```

#### 3.2 減少資料傳輸量

- ✅ 只回傳必要欄位
- ✅ 移除不必要的關聯資料
- ✅ 限制結果數量

### 4. 資料庫連接池優化

#### 4.1 連接池設定

已在 `lib/prisma.ts` 中優化連接池設定：

- **Vercel Serverless**: `connection_limit: 2-3`
- **一般環境**: `connection_limit: 5-10`
- **連接超時**: `pool_timeout: 30-60秒`
- **查詢超時**: `statement_timeout: 30-45秒`

#### 4.2 連接池監控

使用 `lib/db-resilience.ts` 中的健康檢查功能：

```typescript
import { db } from '@/lib/db-resilience'

// 健康檢查
const health = await db.healthCheck()
console.log('Database health:', health)
```

## 🔄 待優化項目

### 1. 前端資料獲取優化

#### 1.1 添加 SWR / React Query

**安裝依賴：**
```bash
npm install swr
# 或
npm install @tanstack/react-query
```

**使用範例：**
```typescript
import useSWR from 'swr'

function PartnersList() {
  const { data, error, isLoading } = useSWR('/api/partners', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 60秒內不重複請求
  })
  
  // ...
}
```

#### 1.2 避免重複請求

- ✅ 使用 SWR/React Query 快取
- ✅ 合併多個 API 請求
- ✅ 使用串接而非並行請求

### 2. 背景任務優化

#### 2.1 資料清理任務

將資料清理操作移到背景任務：

```typescript
// 建立背景任務 API
// app/api/cron/cleanup-old-bookings/route.ts
export async function GET() {
  // 清理超過 50 筆的舊預約
  // ...
}
```

### 3. 快取策略

#### 3.1 API 快取

對於不常變動的資料，使用快取：

```typescript
// Next.js API Route 快取
export const revalidate = 60 // 60秒快取

export async function GET() {
  // ...
}
```

#### 3.2 Redis 快取（可選）

對於高頻查詢，考慮使用 Redis：

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
})

// 快取查詢結果
const cached = await redis.get(`partners:${key}`)
if (cached) return cached

const result = await db.query(...)
await redis.set(`partners:${key}`, result, { ex: 60 }) // 60秒過期
```

## 📊 效能監控

### 1. API 回應時間監控

在每個 API 中添加效能監控：

```typescript
const startTime = Date.now()
// ... 查詢邏輯
const queryTime = Date.now() - startTime
console.log(`API ${route} took ${queryTime}ms`)
```

### 2. 資料庫查詢監控

使用 Prisma 的 query logging：

```typescript
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
  ],
})

prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    console.warn(`Slow query: ${e.query} (${e.duration}ms)`)
  }
})
```

## 🎯 優化目標

- ✅ 所有 API 回應時間 < 1 秒
- ✅ 資料庫查詢時間 < 500ms
- ✅ 前端頁面載入時間 < 1 秒
- ✅ 減少不必要的資料傳輸

## 📝 注意事項

1. **索引維護成本**
   - 索引會增加寫入成本
   - 定期檢查未使用的索引並刪除

2. **查詢優化平衡**
   - 不要過度優化
   - 保持程式碼可讀性

3. **測試**
   - 優化後務必測試功能是否正常
   - 監控生產環境效能

## 🔗 相關文件

- [Prisma 效能優化指南](https://www.prisma.io/docs/guides/performance-and-optimization)
- [PostgreSQL 索引最佳實踐](https://www.postgresql.org/docs/current/indexes.html)
- [Next.js API Routes 優化](https://nextjs.org/docs/api-routes/introduction)

