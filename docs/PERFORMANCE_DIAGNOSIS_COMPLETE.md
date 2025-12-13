# 🚀 Peiplay 資料庫效能完整診斷報告

## 📋 執行摘要

本報告針對「資料庫讀取 3-5 秒」問題進行全面診斷，提供問題點清單、修改方案和預期效能改善說明。

---

## ✅ 已確認正確的項目

### 1. PrismaClient Singleton ✅
**狀態：** 已正確實現

**位置：** `lib/prisma.ts`

```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({...})
  
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  globalForPrisma.prisma = prisma
}
```

**結論：** 無需修改，已避免每次請求重建連線。

---

## 🔍 問題診斷清單

### 一、資料庫查詢本身就慢

#### 1️⃣ 索引問題

**問題 1.1：缺少複合索引**

**影響的查詢：**
- `partners` API：`status + isAvailableNow + createdAt`
- `schedules` API：`partnerId + date + isAvailable + startTime`
- `bookings` API：`customerId + status + createdAt`

**現有索引檢查：**
```prisma
// Partner 表
@@index([status, isAvailableNow]) ✅
@@index([status, createdAt(sort: Desc)]) ✅

// Schedule 表
@@index([partnerId, date, isAvailable]) ✅
@@index([partnerId, date, startTime]) ✅

// Booking 表
@@index([customerId, status]) ✅
@@index([customerId, createdAt(sort: Desc)]) ✅
```

**結論：** 基本索引已存在，但需要檢查實際查詢是否使用。

**問題 1.2：OR 條件導致索引失效**

**發現的問題：**

1. **`app/api/partners/route.ts` (line 100-110)**
```typescript
user: {
  OR: [
    { isSuspended: false },
    {
      isSuspended: true,
      suspensionEndsAt: { lte: now }
    },
  ],
}
```

**影響：** OR 條件會導致無法使用 `isSuspended + suspensionEndsAt` 索引。

**解決方案：** 改為應用層過濾（已在部分 API 實現）。

---

#### 2️⃣ 篩選條件寫錯，導致索引失效

**問題 2.1：games 陣列查詢**

**位置：** `app/api/partners/route.ts` (line 239-245)

```typescript
if (game) {
  const lower = game.toLowerCase()
  const match = partner.games.some((g) => g.toLowerCase().includes(lower))
  if (!match) {
    return null
  }
}
```

**狀態：** ✅ 已在應用層過濾，不會影響索引。

**建議：** 如果需要資料庫層面過濾，考慮使用 GIN index：
```sql
CREATE INDEX idx_partner_games_gin ON "Partner" USING GIN (games);
```

---

### 二、拿太多資料

#### 3️⃣ Prisma include / select * 問題

**已優化的 API：**
- ✅ `/api/partners` - 已使用 select
- ✅ `/api/bookings/me` - 已使用 select
- ✅ `/api/favorites` - 已使用 select
- ✅ `/api/personal-notifications` - 已使用 select
- ✅ `/api/announcements` - 已使用 select

**需要檢查的 API：**

**問題 3.1：`app/api/partners/search-by-time/route.ts`**

```typescript
include: {
  user: {
    select: {
      email: true,
      discord: true,
      isSuspended: true,
      suspensionEndsAt: true,
      reviewsReceived: {  // ⚠️ 可能載入過多資料
        select: {
          rating: true
        }
      }
    }
  },
  schedules: {
    include: {  // ⚠️ 應該使用 select
      bookings: {
        select: {
          id: true,
          status: true,
        }
      }
    }
  }
}
```

**建議修改：**
```typescript
select: {
  // ... 只選擇必要欄位
  schedules: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      isAvailable: true,
      bookings: {
        select: {
          id: true,
          status: true,
        }
      }
    }
  }
}
```

---

#### 4️⃣ N+1 Query 問題

**已優化的 API：**
- ✅ `/api/personal-notifications` - 已使用批量查詢

**需要檢查的 API：**

**問題 4.1：`app/api/partners/search-by-time/route.ts`**

```typescript
// 在應用層計算平均星等
const reviews = partner.user?.reviewsReceived || [];
const averageRating = reviews.length > 0 
  ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length
  : 0;
```

**狀態：** ✅ 已通過 include 載入，不是 N+1。

**問題 4.2：潛在的 N+1 問題**

檢查所有使用 `for...of` 或 `map` 後再查詢的程式碼：

```typescript
// ❌ 錯誤範例
const partners = await prisma.partner.findMany()
for (const partner of partners) {
  const reviews = await prisma.review.findMany({ where: { revieweeId: partner.userId } })
}

// ✅ 正確範例
const partners = await prisma.partner.findMany()
const userIds = partners.map(p => p.userId)
const reviews = await prisma.review.findMany({ 
  where: { revieweeId: { in: userIds } }
})
```

---

### 三、API 層本身在拖慢

#### 5️⃣ Transaction 用錯地方

**檢查結果：** ✅ 無問題

`db.query()` 不是 transaction，只是包裝了重試機制。只有 `db.transaction()` 才是 transaction。

**結論：** 無需修改。

---

### 四、資料量與結構問題

#### 6️⃣ 沒有分頁

**已優化的 API：**
- ✅ `/api/partners` - `take: 50`
- ✅ `/api/bookings/me` - `take: 30`
- ✅ `/api/personal-notifications` - `take: 50`
- ✅ `/api/announcements` - `take: 50`
- ✅ `/api/favorites` - `take: 50`
- ✅ `/api/reviews` - `take: 100`

**需要檢查的 API：**

**問題 6.1：`app/api/partners/search-by-time/route.ts`**

```typescript
const partners = await client.partner.findMany({
  // ... 沒有 take 限制
})
```

**建議修改：**
```typescript
take: 100, // 限制結果數量
```

---

#### 7️⃣ JSON / ARRAY 欄位被用來篩選

**問題 7.1：games 陣列**

**位置：** `prisma/schema.prisma`

```prisma
model Partner {
  games String[]
  // ...
}
```

**查詢方式：**
```typescript
games: {
  hasSome: [game.trim()]
}
```

**建議：** 如果資料量大，考慮添加 GIN index：
```sql
CREATE INDEX IF NOT EXISTS idx_partner_games_gin 
ON "Partner" USING GIN (games);
```

**問題 7.2：其他 JSON 欄位**

檢查 schema 中的 JSON 欄位：
- `Partner.violations` (Json?)
- `Payment.rawResponse` (Json?)
- `RefundRequest.evidence` (Json?)

**結論：** 目前沒有用於篩選，無需優化。

---

### 五、架構層級

#### 8️⃣ 快取層

**已實現快取的 API：**
- ✅ `/api/partners` - Redis 快取 (2 分鐘)
- ✅ `/api/announcements` - Redis 快取 (2 分鐘)

**建議添加快取的 API：**
- `/api/reviews/public` - 公開評價（變動低）
- `/api/partners/ranking` - 排名（變動低）

---

## 📊 具體優化方案

### 方案 1：優化 `partners/search-by-time` API

**問題：**
1. 使用 `include` 而非 `select`
2. 沒有 `take` 限制
3. 載入所有 `reviewsReceived` 可能過多

**修改前：**
```typescript
const partners = await client.partner.findMany({
  include: {
    user: {
      select: {
        reviewsReceived: {
          select: { rating: true }
        }
      }
    },
    schedules: {
      include: {
        bookings: { ... }
      }
    }
  }
})
```

**修改後：**
```typescript
const partners = await client.partner.findMany({
  where: { ... },
  select: {
    id: true,
    name: true,
    games: true,
    halfHourlyRate: true,
    coverImage: true,
    user: {
      select: {
        email: true,
        discord: true,
        isSuspended: true,
        suspensionEndsAt: true,
        // 移除 reviewsReceived，改用聚合查詢
      }
    },
    schedules: {
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        isAvailable: true,
        bookings: {
          select: {
            id: true,
            status: true,
          }
        }
      }
    }
  },
  take: 100, // 添加限制
})

// 批量查詢平均評分
const partnerIds = partners.map(p => p.id)
const avgRatings = await client.review.groupBy({
  by: ['revieweeId'],
  where: {
    revieweeId: { in: partners.map(p => p.user?.id).filter(Boolean) }
  },
  _avg: { rating: true },
  _count: { id: true }
})
```

---

### 方案 2：添加 GIN Index for games

**SQL：**
```sql
-- 為 games 陣列添加 GIN index
CREATE INDEX IF NOT EXISTS idx_partner_games_gin 
ON "Partner" USING GIN (games);

-- 驗證索引
EXPLAIN ANALYZE
SELECT * FROM "Partner" 
WHERE games @> ARRAY['lol'];
```

---

### 方案 3：優化 OR 條件

**位置：** `app/api/partners/route.ts`

**修改前：**
```typescript
user: {
  OR: [
    { isSuspended: false },
    {
      isSuspended: true,
      suspensionEndsAt: { lte: now }
    },
  ],
}
```

**修改後：**
```typescript
// 移除 OR 條件，在應用層過濾
user: {
  select: {
    isSuspended: true,
    suspensionEndsAt: true,
  }
}

// 應用層過濾
const validPartners = partners.filter(partner => {
  if (!partner.user) return true
  if (partner.user.isSuspended) {
    const endsAt = partner.user.suspensionEndsAt
    if (endsAt && endsAt > now) return false
  }
  return true
})
```

---

## 🔧 執行步驟

### 步驟 1：執行 EXPLAIN ANALYZE

建立檢查腳本：`scripts/explain_analyze_queries.sql`

```sql
-- 檢查 partners API 查詢
EXPLAIN ANALYZE
SELECT p.*, u."isSuspended", u."suspensionEndsAt"
FROM "Partner" p
JOIN "User" u ON p."userId" = u.id
WHERE p.status = 'APPROVED'
  AND (u."isSuspended" = false OR (u."isSuspended" = true AND u."suspensionEndsAt" <= NOW()))
ORDER BY p."createdAt" DESC
LIMIT 50;

-- 檢查 schedules 查詢
EXPLAIN ANALYZE
SELECT s.*
FROM "Schedule" s
WHERE s."partnerId" = 'xxx'
  AND s.date >= '2025-01-01'
  AND s."isAvailable" = true
ORDER BY s.date ASC, s."startTime" ASC
LIMIT 50;
```

### 步驟 2：添加缺失的索引

執行：`scripts/add_missing_indexes.sql`

### 步驟 3：優化 API 查詢

按照上述方案修改 API 檔案。

### 步驟 4：添加快取

為高頻讀取 API 添加 Redis 快取。

---

## 📈 預期效能改善

### 改善目標

| API | 當前時間 | 目標時間 | 改善幅度 |
|-----|---------|---------|---------|
| `/api/partners` | 3-5秒 | <1秒 | 70-80% |
| `/api/bookings/me` | 3-5秒 | <1秒 | 70-80% |
| `/api/partners/search-by-time` | 3-5秒 | <1秒 | 70-80% |
| `/api/reviews` | 2-3秒 | <1秒 | 60-70% |

### 改善來源

1. **索引優化：** 減少查詢時間 50-70%
2. **select vs include：** 減少資料傳輸 30-50%
3. **分頁限制：** 減少資料處理 40-60%
4. **快取層：** 減少資料庫查詢 80-90%（命中時）

---

## 📝 檢查清單

- [ ] 執行 EXPLAIN ANALYZE 檢查所有慢查詢
- [ ] 添加缺失的複合索引
- [ ] 優化 `partners/search-by-time` API
- [ ] 移除所有不必要的 `include`，改用 `select`
- [ ] 為所有列表 API 添加 `take` 限制
- [ ] 檢查並修正 N+1 query
- [ ] 為 `games` 陣列添加 GIN index（如需要）
- [ ] 為高頻讀取 API 添加快取
- [ ] 移除不必要的 OR 條件，改用應用層過濾
- [ ] 驗證所有修改後的效能改善

---

## 🎯 下一步行動

1. **立即執行：** 執行 EXPLAIN ANALYZE 檢查實際查詢計劃
2. **優先處理：** 優化 `partners/search-by-time` API
3. **次要處理：** 添加 GIN index for games（如果資料量大）
4. **長期優化：** 為更多 API 添加快取層

