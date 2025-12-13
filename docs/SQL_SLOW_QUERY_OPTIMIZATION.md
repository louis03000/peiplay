# SQL 慢查詢優化實施指南

本文檔根據 SQL 慢查詢優化文章，提供 PeiPlay 資料庫效能優化的完整實施方案。

## 📋 優化目標

根據文章建議，從以下方面優化資料庫效能：
1. **開啟慢查詢日誌**：監控和定位慢查詢
2. **使用 EXPLAIN 分析**：找出查詢效能問題
3. **優化 SQL 語句**：避免全表掃描、善用索引
4. **優化分頁查詢**：避免大偏移量效能問題
5. **建立覆蓋索引**：減少回表查詢

## ✅ 已完成的優化

### 1. 慢查詢日誌配置

**檔案：** `scripts/setup_slow_query_logging.sql`

**功能：**
- 設定慢查詢閾值為 1 秒
- 啟用 pg_stat_statements 擴展
- 配置查詢執行計劃日誌
- 提供慢查詢統計查詢

**執行方式：**
```bash
psql $DATABASE_URL -f scripts/setup_slow_query_logging.sql
```

**注意事項：**
- 需要 PostgreSQL superuser 權限
- 執行後需要重新載入配置：`SELECT pg_reload_conf();`
- 建議定期清理日誌檔案

### 2. EXPLAIN 查詢分析工具

**檔案：** `scripts/explain_query_analyzer.sql`

**功能：**
- 提供 EXPLAIN 分析範例
- 說明關鍵指標（type, key, rows, Extra）
- 提供常見優化建議
- 自動化 EXPLAIN 分析函數

**使用方式：**
```sql
-- 分析特定查詢
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM "Partner" WHERE status = 'APPROVED' LIMIT 10;
```

**關鍵指標說明：**
- **type**: ALL（全表掃描）→ index → range → ref → eq_ref → const（最好）
- **key**: 使用的索引名稱（NULL 表示未使用索引）
- **rows**: 估計掃描的行數（越小越好）
- **Extra**: 
  - `Using index`: 覆蓋索引（最好）
  - `Using where`: 需要回表查詢
  - `Using temporary`: 使用臨時表（應避免）
  - `Using filesort`: 外部排序（應避免）

### 3. 分頁查詢優化

**檔案：** `scripts/optimize_pagination_queries.sql`

**問題：**
- 大偏移量分頁（`LIMIT M, N` 其中 M 很大）需要掃描大量記錄
- 範例：`LIMIT 1000000, 10` 需要掃描 100 萬條記錄

**解決方案：**
- 使用 cursor-based pagination（基於游標的分頁）
- 建立優化的分頁索引
- 提供覆蓋索引優化建議

**優化範例：**
```typescript
// ❌ 錯誤：大偏移量分頁
const bookings = await prisma.booking.findMany({
  where: { customerId },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 1000000, // 需要掃描 100 萬條記錄！
});

// ✅ 正確：cursor-based pagination
const bookings = await prisma.booking.findMany({
  where: {
    customerId,
    ...(cursor ? {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } }
      ]
    } : {})
  },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 10,
});
```

**已優化的 API：**
- `/api/admin/chat` - 支援 cursor pagination

### 4. 覆蓋索引優化

**檔案：** `scripts/check_covering_indexes.sql`

**概念：**
- 當 SELECT 的欄位都包含在使用的索引中時，就不需要回表查詢
- PostgreSQL 使用 `INCLUDE` 子句建立覆蓋索引

**已建立的覆蓋索引：**
- `idx_booking_customer_created_covering` - Booking 表
- `idx_partner_status_created_covering` - Partner 表
- `idx_schedule_partner_date_covering` - Schedule 表
- `idx_personal_notification_user_created_covering` - PersonalNotification 表
- `idx_announcement_active_created_covering` - Announcement 表

**優化原則：**
- ❌ 避免 `SELECT *`
- ✅ 只選擇需要的欄位
- ✅ 為頻繁查詢建立覆蓋索引

### 5. 慢查詢監控 API

**檔案：** `app/api/admin/slow-queries/route.ts`

**功能：**
- 獲取最慢的查詢統計
- 獲取執行次數最多的查詢
- 獲取總執行時間最長的查詢
- 查看當前正在執行的慢查詢
- 查看表掃描統計

**使用方式：**
```bash
# 獲取最慢的查詢
GET /api/admin/slow-queries?type=slowest&limit=20

# 獲取執行次數最多的查詢
GET /api/admin/slow-queries?type=most_called&limit=20

# 獲取總執行時間最長的查詢
GET /api/admin/slow-queries?type=total_time&limit=20
```

**權限：** 需要管理員權限

## 🔍 常見優化模式

### 1. 避免全表掃描

**❌ 錯誤範例：**
```typescript
// 使用函數導致索引失效
where: { name: { contains: searchTerm.toLowerCase() } }

// LIKE '%xxx' 導致索引失效
where: { name: { contains: '%翻譯%' } }
```

**✅ 正確範例：**
```typescript
// 使用 ILIKE 'xxx%'（PostgreSQL）
where: { name: { startsWith: '翻譯' } }

// 或使用全文搜尋
// CREATE INDEX USING gin(to_tsvector('english', name));
```

### 2. 善用覆蓋索引

**❌ 錯誤：**
```typescript
// SELECT * 無法使用覆蓋索引
const partners = await prisma.partner.findMany({
  select: true, // 選擇所有欄位
});
```

**✅ 正確：**
```typescript
// 只選擇需要的欄位，增加使用覆蓋索引的機會
const partners = await prisma.partner.findMany({
  select: {
    id: true,
    name: true,
    games: true,
    halfHourlyRate: true,
  },
});
```

### 3. 避免 OR 條件影響索引

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
// 先查詢所有資料，然後在應用層過濾
const all = await prisma.announcement.findMany({
  where: { isActive: true },
});
const valid = all.filter(a => !a.expiresAt || a.expiresAt > now);
```

### 4. 優化大偏移量分頁

**❌ 錯誤：**
```typescript
// 大偏移量需要掃描大量記錄
skip: 1000000,
take: 10,
```

**✅ 正確：**
```typescript
// 使用 cursor-based pagination
where: {
  ...(cursor ? {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } }
    ]
  } : {})
},
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
take: 10,
```

## 📊 監控與維護

### 定期檢查項目

1. **每天檢查慢查詢日誌**
   ```bash
   # 查看最慢的查詢
   GET /api/admin/slow-queries?type=slowest&limit=20
   ```

2. **每週分析索引使用情況**
   ```sql
   -- 查看未使用的索引
   SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
   
   -- 查看順序掃描最多的表
   SELECT * FROM pg_stat_user_tables ORDER BY seq_scan DESC;
   ```

3. **每月優化查詢**
   - 分析慢查詢日誌
   - 使用 EXPLAIN 分析問題查詢
   - 建立或優化索引
   - 優化 SQL 語句

### 效能指標目標

- **查詢執行時間**：< 100ms（簡單查詢），< 500ms（複雜查詢）
- **索引使用率**：> 90%（避免全表掃描）
- **緩衝區命中率**：> 95%（減少磁碟讀取）
- **慢查詢數量**：< 1%（執行時間 > 1 秒的查詢）

## 🚀 後續優化建議

1. **全文搜尋優化**
   - 為需要模糊搜尋的欄位建立 GIN 索引
   - 使用 PostgreSQL 全文搜尋功能

2. **查詢快取**
   - 使用 Redis 快取頻繁查詢的結果
   - 設定適當的 TTL

3. **資料庫連線池優化**
   - 使用 PgBouncer 管理連線池
   - 設定適當的連線池大小

4. **定期維護**
   - 定期執行 `VACUUM ANALYZE`
   - 監控資料庫大小和 bloat
   - 清理未使用的索引

## 📚 參考資料

- [PostgreSQL EXPLAIN 文檔](https://www.postgresql.org/docs/current/sql-explain.html)
- [PostgreSQL 索引優化](https://www.postgresql.org/docs/current/indexes.html)
- [pg_stat_statements 擴展](https://www.postgresql.org/docs/current/pgstatstatements.html)


