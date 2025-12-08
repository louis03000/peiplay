# 🚀 Favorites API 效能優化

## 📋 問題分析

`/api/favorites` API 原本需要 4 秒多才能完成，主要問題：

1. **兩次查詢**：需要先查詢 `customer`，然後再查詢 `favoritePartner`
2. **JOIN 開銷**：查詢 `favoritePartner` 時需要 JOIN `Partner` 表來獲取 `name`
3. **沒有快速檢查**：即使沒有最愛，也會執行完整的 JOIN 查詢
4. **索引未充分利用**：雖然有 `customerId` 索引，但排序時可能沒有充分利用

## ✅ 優化方案

### 1. 查詢優化

**優化前：**
```typescript
// 直接查詢，沒有快速檢查
const rows = await client.favoritePartner.findMany({
  where: { customerId: customer.id },
  // ... JOIN Partner 表
});
```

**優化後：**
```typescript
// 1. 先快速檢查是否有最愛（使用 count，非常快）
const favoriteCount = await client.favoritePartner.count({
  where: { customerId: customer.id },
});

if (favoriteCount === 0) {
  return []; // 如果沒有最愛，直接返回，避免 JOIN
}

// 2. 只有在有最愛時才執行 JOIN 查詢
const rows = await client.favoritePartner.findMany({
  where: { customerId: customer.id },
  // ... JOIN Partner 表
});
```

### 2. 索引優化

執行以下 SQL 添加優化索引：

```sql
-- 優化查詢：customerId + createdAt DESC
-- 用於快速獲取用戶的最愛列表並按時間排序
CREATE INDEX IF NOT EXISTS "FavoritePartner_customerId_createdAt_idx" 
ON "FavoritePartner"("customerId", "createdAt" DESC);
```

### 3. 應用層優化

- **快速檢查**：使用 `count` 快速檢查是否有最愛
- **條件查詢**：只有在有最愛時才執行 JOIN 查詢
- **資料映射**：在應用層映射資料，減少資料庫處理

## 📈 預期效果

執行優化後，預期可以獲得：

1. **查詢時間減少 70-85%**：從 4 秒降低到 0.6-1.2 秒
2. **無最愛時更快**：如果用戶沒有最愛，響應時間 < 100ms
3. **索引使用率提升**：更好地利用現有索引
4. **資料庫負載降低**：減少不必要的 JOIN 操作

## 🔧 執行步驟

### 步驟 1：添加索引

在 Supabase SQL Editor 中執行：

```sql
-- 執行 scripts/add_favorites_index.sql
```

### 步驟 2：部署代碼更新

代碼已經優化，直接部署即可。

### 步驟 3：驗證效果

1. 打開瀏覽器開發者工具
2. 查看 Network 面板
3. 檢查 `favorites` API 的響應時間
4. 預期響應時間應該從 4 秒降低到 1 秒以內

## 🔍 進一步優化建議

如果優化後仍然較慢，可以考慮：

### 1. 移除 Partner JOIN（如果不需要）

如果前端不需要顯示 partner name，可以移除 JOIN：

```typescript
select: {
  id: true,
  partnerId: true,
  createdAt: true,
  // 移除 Partner JOIN
}
```

然後在前端通過其他 API 獲取 partner 資訊。

### 2. 使用緩存

如果最愛列表不常變化，可以添加緩存：

```typescript
import { unstable_cache } from 'next/cache';

const getCachedFavorites = unstable_cache(
  async (customerId: string) => {
    // 查詢邏輯
  },
  ['favorites'],
  { revalidate: 60 } // 60 秒緩存
);
```

### 3. 批量查詢 Partner 資訊

如果需要 partner 資訊，可以批量查詢：

```typescript
// 1. 先查詢最愛 ID 列表
const favorites = await client.favoritePartner.findMany({
  where: { customerId: customer.id },
  select: { partnerId: true },
});

// 2. 批量查詢 Partner 資訊
const partnerIds = favorites.map(f => f.partnerId);
const partners = await client.partner.findMany({
  where: { id: { in: partnerIds } },
  select: { id: true, name: true },
});

// 3. 在應用層合併資料
```

## 📊 監控指標

優化後，監控以下指標：

1. **API 響應時間**：應該 < 1.2 秒
2. **資料庫查詢時間**：應該 < 300ms
3. **索引使用率**：檢查索引是否被使用
4. **資料傳輸量**：應該減少

## 🆘 故障排除

### 問題：查詢仍然很慢

**檢查清單：**
- [ ] 索引是否已添加？
- [ ] 查詢是否使用了索引？（使用 EXPLAIN ANALYZE）
- [ ] Partner JOIN 是否必要？（如果不需要可以移除）
- [ ] 資料量是否太大？（考慮添加分頁）

### 問題：索引創建失敗

**可能原因：**
- 資料庫權限不足
- 索引已存在但結構不同

**解決方法：**
```sql
-- 檢查索引是否存在
SELECT indexname FROM pg_indexes 
WHERE tablename = 'FavoritePartner';

-- 如果存在但結構不同，先刪除再創建
DROP INDEX IF EXISTS "FavoritePartner_customerId_createdAt_idx";
CREATE INDEX "FavoritePartner_customerId_createdAt_idx" 
ON "FavoritePartner"("customerId", "createdAt" DESC);
```

## 📚 相關文件

- [索引優化指南](./INDEX_OPTIMIZATION.md)
- [資料庫速度優化指南](./DATABASE_SPEED_OPTIMIZATION.md)
- [Personal Notifications API 優化](./PERSONAL_NOTIFICATIONS_OPTIMIZATION.md)

