# 🚀 Personal Notifications API 效能優化

## 📋 問題分析

`/api/personal-notifications` API 原本需要 4 秒多才能完成，主要問題：

1. **OR 條件影響索引使用**：查詢使用了 `OR` 條件來過濾過期通知，導致無法有效使用索引
2. **複雜的排序**：多欄位排序（isImportant, priority, createdAt）需要額外的排序操作
3. **JOIN 開銷**：查詢 sender 資訊需要 JOIN User 表
4. **索引不匹配**：現有索引無法完全支援查詢模式

## ✅ 優化方案

### 1. 查詢優化

**優化前：**
```typescript
// 使用 OR 條件，無法有效使用索引
where: {
  userId: session.user.id,
  OR: [
    { expiresAt: null },
    { expiresAt: { gt: now } }
  ],
},
orderBy: [
  { isImportant: 'desc' },
  { priority: 'desc' },
  { createdAt: 'desc' }
]
```

**優化後：**
```typescript
// 1. 先查詢最近的 100 筆通知（使用 userId + createdAt 索引）
// 2. 在應用層過濾過期通知（避免 OR 條件）
// 3. 在應用層排序（避免複雜的資料庫排序）
where: {
  userId: session.user.id,
},
orderBy: { createdAt: 'desc' },
take: 100
// 然後在應用層過濾和排序
```

### 2. 索引優化

執行以下 SQL 添加優化索引：

```sql
-- 主要查詢索引（已存在於 add_additional_performance_indexes.sql）
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isRead_createdAt_idx" 
ON "PersonalNotification"("userId", "isRead", "createdAt" DESC);

-- 優化重要通知查詢
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isImportant_priority_createdAt_idx" 
ON "PersonalNotification"("userId", "isImportant", "priority" DESC, "createdAt" DESC);

-- 優化過期通知過濾
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_expiresAt_createdAt_idx" 
ON "PersonalNotification"("userId", "expiresAt" NULLS FIRST, "createdAt" DESC);
```

### 3. 應用層優化

- **過濾過期通知**：在應用層過濾，避免資料庫的 OR 條件
- **排序優化**：在應用層排序，減少資料庫排序開銷
- **限制資料量**：先取 100 筆，然後在應用層過濾和排序，最後返回 50 筆

## 📈 預期效果

執行優化後，預期可以獲得：

1. **查詢時間減少 60-80%**：從 4 秒降低到 0.8-1.5 秒
2. **索引使用率提升**：更好地利用現有索引
3. **資料庫負載降低**：減少複雜的排序和過濾操作

## 🔧 執行步驟

### 步驟 1：添加索引

在 Supabase SQL Editor 中執行：

```sql
-- 執行 scripts/add_personal_notification_index.sql
```

### 步驟 2：部署代碼更新

代碼已經優化，直接部署即可。

### 步驟 3：驗證效果

1. 打開瀏覽器開發者工具
2. 查看 Network 面板
3. 檢查 `personal-notifications` API 的響應時間
4. 預期響應時間應該從 4 秒降低到 1 秒以內

## 🔍 進一步優化建議

如果優化後仍然較慢，可以考慮：

### 1. 移除 sender JOIN（如果不需要）

如果前端不需要顯示 sender 資訊，可以移除 JOIN：

```typescript
select: {
  // ... 其他欄位
  // 移除 sender
}
```

### 2. 使用部分索引

如果大部分通知都會過期，可以使用部分索引：

```sql
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_active_createdAt_idx" 
ON "PersonalNotification"("userId", "createdAt" DESC)
WHERE "expiresAt" IS NULL OR "expiresAt" > NOW();
```

### 3. 添加緩存

如果通知不常變化，可以添加緩存：

```typescript
// 使用 Next.js 的 unstable_cache 或 Redis
import { unstable_cache } from 'next/cache';

const getCachedNotifications = unstable_cache(
  async (userId: string) => {
    // 查詢邏輯
  },
  ['personal-notifications'],
  { revalidate: 60 } // 60 秒緩存
);
```

### 4. 分頁查詢

如果通知數量很多，可以實現分頁：

```typescript
const { searchParams } = new URL(request.url);
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '50');
const skip = (page - 1) * limit;
```

## 📊 監控指標

優化後，監控以下指標：

1. **API 響應時間**：應該 < 1.5 秒
2. **資料庫查詢時間**：應該 < 500ms
3. **索引使用率**：檢查索引是否被使用
4. **資料傳輸量**：應該減少

## 🆘 故障排除

### 問題：查詢仍然很慢

**檢查清單：**
- [ ] 索引是否已添加？
- [ ] 查詢是否使用了索引？（使用 EXPLAIN ANALYZE）
- [ ] 資料量是否太大？（考慮添加分頁）
- [ ] sender JOIN 是否必要？（如果不需要可以移除）

### 問題：索引創建失敗

**可能原因：**
- 資料庫權限不足
- 索引已存在但結構不同

**解決方法：**
```sql
-- 檢查索引是否存在
SELECT indexname FROM pg_indexes 
WHERE tablename = 'PersonalNotification';

-- 如果存在但結構不同，先刪除再創建
DROP INDEX IF EXISTS "PersonalNotification_userId_isImportant_priority_createdAt_idx";
CREATE INDEX "PersonalNotification_userId_isImportant_priority_createdAt_idx" 
ON "PersonalNotification"("userId", "isImportant", "priority" DESC, "createdAt" DESC);
```

## 📚 相關文件

- [索引優化指南](./INDEX_OPTIMIZATION.md)
- [資料庫速度優化指南](./DATABASE_SPEED_OPTIMIZATION.md)

