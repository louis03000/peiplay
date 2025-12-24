# 架構隔離改造報告

## 📋 改造目標

確保任一 API 修改不會影響其他 API，DB / cache / time / transaction 行為完全可預期，適用於 Vercel Serverless 環境。

## 🏗️ Before / After 架構差異

### Before（改造前）

```
問題架構：
├── lib/prisma.ts (多處可能創建 client)
├── lib/db-resilience.ts (使用 lib/prisma.ts)
├── lib/db-connection.ts (另一個 client 管理器)
├── lib/db-utils.ts (又一個管理器)
├── lib/time-utils.ts (各自使用 dayjs.extend)
└── API Routes
    ├── app/api/bookings/route.ts (直接操作 DB)
    ├── app/api/multi-player-booking/route.ts (直接操作 DB)
    └── ... (所有 API 都直接操作 DB)

問題：
❌ 多個 DB client 實例可能互相影響
❌ Transaction 可能洩漏到其他 request
❌ 時間處理不一致
❌ 沒有 Service Layer，業務邏輯混在 API 中
❌ 沒有 Cache 命名空間
❌ API 錯誤處理不一致
```

### After（改造後）

```
新架構：
├── lib/db/
│   └── client.ts (統一單例 DB Client)
├── lib/db-resilience.ts (使用 lib/db/client.ts)
├── lib/time/
│   └── index.ts (統一時間處理)
├── lib/time-utils.ts (向後兼容層)
├── lib/cache/
│   └── index.ts (Cache 命名空間)
├── lib/api-guard.ts (API 防護機制)
├── services/
│   ├── booking/
│   │   ├── booking.service.ts (業務邏輯)
│   │   └── booking.types.ts (型別定義)
│   ├── chat/
│   └── auth/
└── API Routes
    ├── app/api/bookings/route.ts (只呼叫 service)
    └── ... (所有 API 都透過 service)

優勢：
✅ 單一 DB client，完全隔離
✅ Transaction 完全在 service 內
✅ 統一時間處理
✅ Service Layer 隔離業務邏輯
✅ Cache 命名空間防止衝突
✅ API 統一錯誤處理
```

## 🚨 共用高風險檔案清單

### 1. 資料庫相關（最高風險）

| 檔案 | 風險等級 | 原因 | 改造狀態 |
|------|---------|------|---------|
| `lib/prisma.ts` | 🔴 極高 | 多處可能創建 client | ✅ 已遷移到 `lib/db/client.ts` |
| `lib/db-resilience.ts` | 🟡 中 | 使用共用 client | ✅ 已更新使用新 client |
| `lib/db-connection.ts` | 🔴 極高 | 另一個 client 管理器 | ⚠️ 需移除或整合 |
| `lib/db-utils.ts` | 🔴 極高 | 又一個管理器 | ⚠️ 需移除或整合 |

### 2. 時間處理相關（高風險）

| 檔案 | 風險等級 | 原因 | 改造狀態 |
|------|---------|------|---------|
| `lib/time-utils.ts` | 🟡 中 | 各自使用 dayjs.extend | ✅ 已更新為向後兼容層 |
| `lib/time/index.ts` | ✅ 新 | 統一時間處理 | ✅ 已創建 |

### 3. API Routes（中風險）

| 檔案 | 風險等級 | 原因 | 改造狀態 |
|------|---------|------|---------|
| `app/api/bookings/route.ts` | 🟡 中 | 直接操作 DB，無 Service Layer | ⚠️ 需遷移到 service |
| `app/api/multi-player-booking/route.ts` | 🟡 中 | 直接操作 DB | ⚠️ 需遷移到 service |
| `app/api/partner/schedule/route.ts` | 🟡 中 | 直接操作 DB | ⚠️ 需遷移到 service |

### 4. 共用工具（中風險）

| 檔案 | 風險等級 | 原因 | 改造狀態 |
|------|---------|------|---------|
| `lib/api-helpers.ts` | 🟡 中 | 共用錯誤處理 | ✅ 已創建 `lib/api-guard.ts` |
| `lib/email.ts` | 🟢 低 | 獨立功能 | ✅ 無需改造 |
| `lib/notifications.ts` | 🟢 低 | 獨立功能 | ✅ 無需改造 |

## 🔍 已知互相影響案例

### 案例 1: 預約衝突（409 Conflict）

**問題描述：**
- 修改 `/api/bookings` 的衝突檢查邏輯
- `/api/multi-player-booking` 也開始出現衝突錯誤

**根本原因：**
- 兩個 API 共用同一個 DB client
- 共用相同的 transaction 邏輯
- 時間處理不一致

**解決方案：**
- ✅ 統一 DB client (`lib/db/client.ts`)
- ✅ 統一時間處理 (`lib/time/index.ts`)
- ⚠️ 待完成：遷移到 Service Layer

### 案例 2: 時段管理頁面顯示問題

**問題描述：**
- 修改 `/api/partner/schedule` 的重複檢查
- 時段管理頁面顯示不一致

**根本原因：**
- 前端快取與後端邏輯不同步
- 沒有 Cache 命名空間

**解決方案：**
- ✅ 創建 Cache 命名空間 (`lib/cache/index.ts`)
- ⚠️ 待完成：更新前端使用新的 cache

### 案例 3: 時間顯示不一致

**問題描述：**
- 不同 API 返回的時間格式不一致
- 前端顯示的時間與資料庫時間不匹配

**根本原因：**
- 各自使用不同的時間處理方式
- 沒有統一的時間轉換邏輯

**解決方案：**
- ✅ 統一時間處理 (`lib/time/index.ts`)
- ⚠️ 待完成：更新所有 API 使用新的時間工具

## 📝 遷移檢查清單

### Phase 1: 基礎設施（已完成 ✅）

- [x] 創建統一 DB Client (`lib/db/client.ts`)
- [x] 更新 `db-resilience.ts` 使用新 client
- [x] 創建統一時間工具 (`lib/time/index.ts`)
- [x] 更新 `time-utils.ts` 為向後兼容層
- [x] 創建 Cache 命名空間 (`lib/cache/index.ts`)
- [x] 創建 API 防護機制 (`lib/api-guard.ts`)

### Phase 2: Service Layer（進行中 ⚠️）

- [x] 創建 Booking Service 基礎結構
- [ ] 完成 Booking Service 實現
- [ ] 創建 Schedule Service
- [ ] 創建 Chat Service
- [ ] 創建 Auth Service

### Phase 3: API 遷移（待完成 ⏳）

- [ ] 遷移 `/api/bookings` 使用 Booking Service
- [ ] 遷移 `/api/multi-player-booking` 使用 Service
- [ ] 遷移 `/api/partner/schedule` 使用 Service
- [ ] 所有 API 添加 `withApiGuard`

### Phase 4: 清理（待完成 ⏳）

- [ ] 移除 `lib/db-connection.ts`（如果不再使用）
- [ ] 移除 `lib/db-utils.ts`（如果不再使用）
- [ ] 更新所有 import 使用新的 client
- [ ] 更新所有時間處理使用新的工具

## 🎯 使用指南

### 1. 使用統一 DB Client

```typescript
// ✅ 正確
import { prisma } from '@/lib/db/client'

// ❌ 錯誤
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient() // 禁止！
```

### 2. 使用統一時間工具

```typescript
// ✅ 正確
import { getNowTaipei, taipeiToUTC, formatTaipei } from '@/lib/time'

// ❌ 錯誤
import dayjs from 'dayjs'
dayjs.extend(utc) // 禁止！
```

### 3. 使用 Service Layer

```typescript
// ✅ 正確
import { createBooking } from '@/services/booking/booking.service'

const result = await createBooking({ scheduleIds, customerId })
if (!result.success) {
  return NextResponse.json({ error: result.error.message }, { status: 409 })
}

// ❌ 錯誤
const booking = await prisma.booking.create({ ... }) // 禁止在 API 中直接操作！
```

### 4. 使用 Cache 命名空間

```typescript
// ✅ 正確
import { bookingCache } from '@/lib/cache'

bookingCache.set('user:123', data, 300)
const data = bookingCache.get('user:123')

// ❌ 錯誤
cache.set('bookings', data) // 禁止簡短 key！
```

### 5. 使用 API Guard

```typescript
// ✅ 正確
import { withApiGuard, validateMethod, validateJsonBody } from '@/lib/api-guard'

export const POST = withApiGuard(async (request: Request) => {
  const methodError = validateMethod(request, ['POST'])
  if (methodError) return methodError

  const bodyResult = await validateJsonBody(request)
  if (!bodyResult.valid) return bodyResult.error

  // ... 業務邏輯
  return NextResponse.json({ success: true })
})
```

## ⚠️ 重要注意事項

1. **嚴禁在任何地方呼叫 `prisma.$disconnect()`**
   - 這會影響所有其他 API
   - 只有在應用關閉時才應 disconnect

2. **Transaction 必須完全在 function scope 內**
   - 不可將 `tx` 傳出 function
   - 不可在 transaction 內呼叫其他 service

3. **禁止直接 `new PrismaClient()`**
   - 必須使用 `lib/db/client.ts` 的單例

4. **禁止直接使用 `dayjs.extend()`**
   - 必須使用 `lib/time/index.ts` 提供的函數

5. **Cache key 必須使用命名空間**
   - 禁止使用簡短 key（如 `'bookings'`）
   - 必須使用 `getCacheKey()` 或命名空間快捷函數

## 📊 改造進度

- **基礎設施**: 100% ✅
- **Service Layer**: 20% ⚠️
- **API 遷移**: 0% ⏳
- **清理工作**: 0% ⏳

**整體進度**: 30%

## 🔄 下一步行動

1. 完成 Booking Service 的完整實現
2. 遷移 `/api/bookings` 使用新的 service
3. 逐步遷移其他 API
4. 清理舊的檔案和 import

