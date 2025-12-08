# 🚀 Announcements API 效能優化

## 📋 問題分析

`/api/announcements` API 原本需要 3 秒多才能完成，主要問題：

1. **OR 條件影響索引使用**：查詢使用了 `OR` 條件來過濾過期公告，導致無法有效使用索引
2. **使用 include 而非 select**：載入了所有欄位，增加資料傳輸量
3. **JOIN 開銷**：查詢 `creator` 資訊需要 JOIN User 表
4. **沒有限制結果數量**：可能載入過多不必要的資料

## ✅ 優化方案

### 1. 查詢優化

**優化前：**
```typescript
// 使用 OR 條件，無法有效使用索引
where: {
  isActive: true,
  OR: [
    { expiresAt: null },
    { expiresAt: { gt: now } }
  ]
},
include: {
  creator: {
    select: { name: true }
  }
}
```

**優化後：**
```typescript
// 1. 先查詢所有活躍公告（使用 isActive 索引）
// 2. 在應用層過濾過期公告（避免 OR 條件）
// 3. 使用 select 只查詢必要欄位
// 4. 限制結果數量
where: {
  isActive: true,
},
select: {
  id: true,
  title: true,
  content: true,
  type: true,
  expiresAt: true,
  createdAt: true,
  creator: {
    select: { name: true }
  }
},
orderBy: { createdAt: 'desc' },
take: 50
// 然後在應用層過濾過期公告
```

### 2. 索引優化

執行以下 SQL 添加優化索引：

```sql
-- 優化查詢：isActive + createdAt DESC
-- 用於快速獲取活躍公告並按時間排序
CREATE INDEX IF NOT EXISTS "Announcement_isActive_createdAt_idx" 
ON "Announcement"("isActive", "createdAt" DESC);

-- 優化查詢：isActive + expiresAt + createdAt
-- 用於過濾未過期的公告並按時間排序
CREATE INDEX IF NOT EXISTS "Announcement_isActive_expiresAt_createdAt_idx" 
ON "Announcement"("isActive", "expiresAt" NULLS FIRST, "createdAt" DESC);
```

### 3. 應用層優化

- **過濾過期公告**：在應用層過濾，避免資料庫的 OR 條件
- **使用 select**：只查詢必要欄位，減少資料傳輸
- **限制資料量**：只載入最近的 50 筆公告
- **資料格式化**：在應用層格式化，減少資料庫處理

## 📈 預期效果

執行優化後，預期可以獲得：

1. **查詢時間減少 70-85%**：從 3 秒降低到 0.5-1 秒
2. **索引使用率提升**：更好地利用現有索引
3. **資料傳輸量減少**：只查詢必要欄位
4. **資料庫負載降低**：減少複雜的過濾操作

## 🔧 執行步驟

### 步驟 1：添加索引

在 Supabase SQL Editor 中執行：

```sql
-- 執行 scripts/add_announcements_index.sql
```

### 步驟 2：部署代碼更新

代碼已經優化，直接部署即可。

### 步驟 3：驗證效果

1. 打開瀏覽器開發者工具
2. 查看 Network 面板
3. 檢查 `announcements` API 的響應時間
4. 預期響應時間應該從 3 秒降低到 1 秒以內

## 🔍 進一步優化建議

如果優化後仍然較慢，可以考慮：

### 1. 移除 Creator JOIN（如果不需要）

如果前端不需要顯示 creator name，可以移除 JOIN：

```typescript
select: {
  id: true,
  title: true,
  content: true,
  type: true,
  expiresAt: true,
  createdAt: true,
  // 移除 creator JOIN
}
```

### 2. 使用緩存

如果公告不常變化，可以添加緩存：

```typescript
import { unstable_cache } from 'next/cache';

const getCachedAnnouncements = unstable_cache(
  async () => {
    // 查詢邏輯
  },
  ['announcements'],
  { revalidate: 300 } // 5 分鐘緩存
);
```

### 3. 使用部分索引

如果大部分公告都會過期，可以使用部分索引：

```sql
CREATE INDEX IF NOT EXISTS "Announcement_active_not_expired_createdAt_idx" 
ON "Announcement"("createdAt" DESC)
WHERE "isActive" = true AND ("expiresAt" IS NULL OR "expiresAt" > NOW());
```

這個索引只索引活躍且未過期的公告，會更小更快。

### 4. 實現分頁

如果公告數量很多，可以實現分頁：

```typescript
const { searchParams } = new URL(request.url);
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '20');
const skip = (page - 1) * limit;
```

## 📊 監控指標

優化後，監控以下指標：

1. **API 響應時間**：應該 < 1 秒
2. **資料庫查詢時間**：應該 < 300ms
3. **索引使用率**：檢查索引是否被使用
4. **資料傳輸量**：應該減少

## 🆘 故障排除

### 問題：查詢仍然很慢

**檢查清單：**
- [ ] 索引是否已添加？
- [ ] 查詢是否使用了索引？（使用 EXPLAIN ANALYZE）
- [ ] Creator JOIN 是否必要？（如果不需要可以移除）
- [ ] 資料量是否太大？（考慮添加分頁）

### 問題：索引創建失敗

**可能原因：**
- 資料庫權限不足
- 索引已存在但結構不同

**解決方法：**
```sql
-- 檢查索引是否存在
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Announcement';

-- 如果存在但結構不同，先刪除再創建
DROP INDEX IF EXISTS "Announcement_isActive_createdAt_idx";
CREATE INDEX "Announcement_isActive_createdAt_idx" 
ON "Announcement"("isActive", "createdAt" DESC);
```

## 📚 相關文件

- [索引優化指南](./INDEX_OPTIMIZATION.md)
- [資料庫速度優化指南](./DATABASE_SPEED_OPTIMIZATION.md)
- [Personal Notifications API 優化](./PERSONAL_NOTIFICATIONS_OPTIMIZATION.md)
- [Favorites API 優化](./FAVORITES_API_OPTIMIZATION.md)

