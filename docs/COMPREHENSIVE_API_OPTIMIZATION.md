# 🚀 Peiplay API 全面效能優化指南

## 📋 概述

本文件提供 Peiplay 所有 API 的全面效能優化方案，解決多個 API 響應時間過長的問題。

## 🎯 優化目標

將所有 API 的響應時間從 3-9 秒降低到 1 秒以內。

## 🔍 主要問題分析

### 1. 常見效能問題

- **OR 條件影響索引使用**：多個 API 使用 OR 條件，導致無法有效使用索引
- **使用 include 而非 select**：載入了不必要的欄位，增加資料傳輸量
- **沒有限制結果數量**：載入過多不必要的資料
- **複雜的嵌套查詢**：多層 JOIN 導致查詢變慢
- **缺少必要的索引**：查詢無法有效使用索引
- **刪除操作在查詢中**：`bookings/me` API 在查詢時刪除資料，非常慢

### 2. 受影響的 API

- `/api/bookings/me` - 4 秒
- `/api/partners` - 9 秒
- `/api/personal-notifications` - 4 秒（已優化）
- `/api/favorites` - 4 秒（已優化）
- `/api/announcements` - 3 秒（已優化）

## ✅ 優化方案

### 1. 索引優化

執行 `scripts/comprehensive_performance_optimization.sql` 添加所有必要的索引：

```sql
-- 一次性添加所有優化索引
-- 包括 Booking, Schedule, Partner, User, PersonalNotification, 
-- FavoritePartner, Announcement, GroupBooking, MultiPlayerBooking, Review
```

### 2. API 查詢優化原則

#### 原則 1：使用 select 而非 include

**❌ 錯誤：**
```typescript
include: {
  partner: true  // 載入所有欄位
}
```

**✅ 正確：**
```typescript
select: {
  partner: {
    select: {
      id: true,
      name: true,  // 只查詢必要欄位
    }
  }
}
```

#### 原則 2：避免 OR 條件

**❌ 錯誤：**
```typescript
where: {
  OR: [
    { expiresAt: null },
    { expiresAt: { gt: now } }
  ]
}
```

**✅ 正確：**
```typescript
// 先查詢所有資料
where: {
  isActive: true
}
// 然後在應用層過濾
const valid = all.filter(item => !item.expiresAt || item.expiresAt > now);
```

#### 原則 3：限制結果數量

**❌ 錯誤：**
```typescript
findMany({
  // 沒有 take，可能載入數千筆資料
})
```

**✅ 正確：**
```typescript
findMany({
  take: 50  // 限制為 50 筆
})
```

#### 原則 4：避免在查詢中刪除資料

**❌ 錯誤：**
```typescript
const all = await findMany();
if (all.length > 50) {
  await deleteMany({ id: { in: idsToDelete } });  // 很慢！
}
```

**✅ 正確：**
```typescript
const items = await findMany({
  take: 50  // 直接限制查詢結果
});
```

#### 原則 5：使用索引優化的排序

**❌ 錯誤：**
```typescript
orderBy: [
  { isImportant: 'desc' },
  { priority: 'desc' },
  { createdAt: 'desc' }
]  // 複雜排序，無法使用索引
```

**✅ 正確：**
```typescript
orderBy: { createdAt: 'desc' }  // 使用索引排序
// 然後在應用層排序
const sorted = items.sort((a, b) => {
  // 應用層排序邏輯
});
```

### 3. 具體 API 優化

#### `/api/bookings/me`

**問題：**
- 在查詢時刪除超過 50 筆的預約（非常慢）
- 查詢了不必要的 customer 欄位

**優化：**
- 直接使用 `take: 50` 限制查詢結果
- 移除 customer 查詢（已經知道 customerId）
- 添加 `customerId + createdAt DESC` 索引

#### `/api/partners`

**問題：**
- 複雜的嵌套查詢
- 多層 JOIN
- 沒有充分利用索引

**優化：**
- 優化 Schedule 查詢條件
- 確保使用正確的索引
- 限制每個 partner 的時段數量（已實現）

#### `/api/personal-notifications`

**已優化：**
- 移除 OR 條件
- 在應用層過濾和排序
- 添加必要的索引

#### `/api/favorites`

**已優化：**
- 快速檢查是否有最愛
- 添加必要的索引

#### `/api/announcements`

**已優化：**
- 移除 OR 條件
- 使用 select 而非 include
- 添加必要的索引

## 📈 預期效果

執行全面優化後，預期可以獲得：

1. **整體 API 響應時間減少 70-85%**
   - `/api/bookings/me`: 從 4 秒降低到 0.5-1 秒
   - `/api/partners`: 從 9 秒降低到 1-2 秒
   - `/api/personal-notifications`: 從 4 秒降低到 0.8-1.5 秒
   - `/api/favorites`: 從 4 秒降低到 0.6-1.2 秒
   - `/api/announcements`: 從 3 秒降低到 0.5-1 秒

2. **資料庫負載降低 50-70%**
   - 減少不必要的查詢
   - 減少資料傳輸量
   - 減少排序和過濾操作

3. **用戶體驗大幅提升**
   - 頁面載入速度更快
   - 減少等待時間
   - 提升用戶滿意度

## 🔧 執行步驟

### 步驟 1：備份資料庫

**⚠️ 重要：執行任何索引操作前，請先備份資料庫！**

### 步驟 2：添加索引

在 Supabase SQL Editor 中執行：

```sql
-- 執行 scripts/comprehensive_performance_optimization.sql
```

這會一次性添加所有必要的索引。

### 步驟 3：部署代碼更新

代碼已經優化，直接部署即可。

### 步驟 4：驗證效果

1. 打開瀏覽器開發者工具
2. 查看 Network 面板
3. 檢查各個 API 的響應時間
4. 預期所有 API 響應時間應該 < 2 秒

## 🔍 進一步優化建議

### 1. 添加緩存

對於不常變化的資料，可以添加緩存：

```typescript
import { unstable_cache } from 'next/cache';

const getCachedData = unstable_cache(
  async () => {
    // 查詢邏輯
  },
  ['cache-key'],
  { revalidate: 300 } // 5 分鐘緩存
);
```

### 2. 實現分頁

如果資料量很大，可以實現分頁：

```typescript
const { searchParams } = new URL(request.url);
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '20');
const skip = (page - 1) * limit;
```

### 3. 使用資料庫連接池

確保使用 Supabase Pooler URL 以獲得更好的連接效能。

### 4. 監控慢查詢

定期檢查慢查詢：

```sql
SELECT 
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## 📊 監控指標

優化後，監控以下指標：

1. **API 響應時間**：應該 < 2 秒
2. **資料庫查詢時間**：應該 < 500ms
3. **索引使用率**：檢查索引是否被使用
4. **資料傳輸量**：應該減少
5. **錯誤率**：應該保持穩定

## 🆘 故障排除

### 問題：某些 API 仍然很慢

**檢查清單：**
- [ ] 索引是否已添加？
- [ ] 查詢是否使用了索引？（使用 EXPLAIN ANALYZE）
- [ ] 是否還有 OR 條件？
- [ ] 是否使用了 include 而非 select？
- [ ] 是否限制了結果數量？

### 問題：索引創建失敗

**可能原因：**
- 資料庫權限不足
- 索引已存在但結構不同

**解決方法：**
```sql
-- 檢查索引是否存在
SELECT indexname FROM pg_indexes 
WHERE tablename = 'YourTable';

-- 如果存在但結構不同，先刪除再創建
DROP INDEX IF EXISTS "YourIndex";
CREATE INDEX "YourIndex" ON "YourTable"(...);
```

## 📚 相關文件

- [索引優化指南](./INDEX_OPTIMIZATION.md)
- [資料庫速度優化指南](./DATABASE_SPEED_OPTIMIZATION.md)
- [Personal Notifications API 優化](./PERSONAL_NOTIFICATIONS_OPTIMIZATION.md)
- [Favorites API 優化](./FAVORITES_API_OPTIMIZATION.md)
- [Announcements API 優化](./ANNOUNCEMENTS_API_OPTIMIZATION.md)

## 🎉 總結

通過全面的索引優化和查詢優化，Peiplay 的所有 API 響應時間應該能夠大幅降低。請按照本指南執行優化，並持續監控效能指標。

