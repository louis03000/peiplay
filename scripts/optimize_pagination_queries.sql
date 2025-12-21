-- ============================================
-- 分頁查詢優化腳本
-- ============================================
-- 根據文章建議，優化大偏移量分頁查詢
-- ============================================

-- ============================================
-- 問題說明
-- ============================================
-- 當使用 LIMIT M, N 且 M 很大時（如 LIMIT 1000000, 10），
-- PostgreSQL 必須掃描並跳過前面的 M 條記錄，開銷巨大。
-- 
-- 優化方法：使用 cursor-based pagination（基於游標的分頁）

-- ============================================
-- 1. 傳統分頁（慢）- 避免使用
-- ============================================

-- ❌ 錯誤範例：大偏移量分頁
-- SELECT * FROM "Booking"
-- WHERE "customerId" = 'xxx'
-- ORDER BY "createdAt" DESC
-- LIMIT 1000000, 10;  -- 需要掃描 100 萬條記錄！

-- ============================================
-- 2. Cursor-based Pagination（快）- 推薦使用
-- ============================================

-- ✅ 正確範例 1: 使用 ID 游標
-- 第一頁
SELECT * FROM "Booking"
WHERE "customerId" = 'xxx'
ORDER BY id ASC
LIMIT 10;

-- 第二頁（使用上一頁最後一筆的 ID）
SELECT * FROM "Booking"
WHERE "customerId" = 'xxx'
  AND id > 'last_id_from_previous_page'
ORDER BY id ASC
LIMIT 10;

-- ✅ 正確範例 2: 使用時間戳游標
-- 第一頁
SELECT * FROM "Booking"
WHERE "customerId" = 'xxx'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;

-- 第二頁（使用上一頁最後一筆的時間戳和 ID）
SELECT * FROM "Booking"
WHERE "customerId" = 'xxx'
  AND ("createdAt" < 'last_created_at' 
       OR ("createdAt" = 'last_created_at' AND id < 'last_id'))
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;

-- ============================================
-- 3. 為分頁查詢建立優化索引
-- ============================================

-- 3.1 Booking 表分頁索引
-- 用於：WHERE customerId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_booking_customer_created_desc" 
ON "Booking"("customerId", "createdAt" DESC, id DESC);

-- 3.2 Partner 表分頁索引
-- 用於：WHERE status = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_partner_status_created_desc" 
ON "Partner"("status", "createdAt" DESC, id DESC);

-- 3.3 Schedule 表分頁索引
-- 用於：WHERE partnerId = ? ORDER BY date, startTime
CREATE INDEX IF NOT EXISTS "idx_schedule_partner_date_start" 
ON "Schedule"("partnerId", date, "startTime", id);

-- 3.4 ChatMessage 表分頁索引
-- 用於：WHERE roomId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_chat_message_room_created_desc" 
ON "ChatMessage"("roomId", "createdAt" DESC, id DESC);

-- ============================================
-- 4. 覆蓋索引優化（Covering Index）
-- ============================================
-- 如果查詢只需要索引中的欄位，就不需要回表查詢

-- 範例：查詢只需要 id, createdAt, status
-- 建立包含這些欄位的索引
CREATE INDEX IF NOT EXISTS "idx_booking_customer_created_covering" 
ON "Booking"("customerId", "createdAt" DESC)
INCLUDE (id, status, "finalAmount");

-- ============================================
-- 5. 檢查現有分頁查詢的效能
-- ============================================

-- 使用 EXPLAIN ANALYZE 檢查分頁查詢
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM "Booking"
WHERE "customerId" = 'YOUR_CUSTOMER_ID'
ORDER BY "createdAt" DESC
LIMIT 10 OFFSET 1000;  -- 檢查大偏移量的效能

-- 如果執行計劃顯示：
-- - Seq Scan: 需要優化（添加索引）
-- - Index Scan: 良好
-- - 如果 rows 很大：考慮使用 cursor-based pagination

-- ============================================
-- 6. 實作建議
-- ============================================

-- 6.1 API 端點應該支援兩種分頁方式：
-- - 傳統分頁：?page=1&limit=10（僅用於前幾頁）
-- - 游標分頁：?cursor=xxx&limit=10（推薦用於深層分頁）

-- 6.2 前端應該：
-- - 前 3-5 頁使用傳統分頁
-- - 之後使用游標分頁
-- - 或者完全使用游標分頁

-- 6.3 範例實作（TypeScript/Prisma）：
/*
// 傳統分頁（僅用於前幾頁）
const bookings = await prisma.booking.findMany({
  where: { customerId },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: (page - 1) * limit,  // 僅當 page <= 5 時使用
});

// 游標分頁（推薦）
const bookings = await prisma.booking.findMany({
  where: {
    customerId,
    ...(cursor ? {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { 
          createdAt: cursor.createdAt,
          id: { lt: cursor.id }
        }
      ]
    } : {})
  },
  orderBy: [
    { createdAt: 'desc' },
    { id: 'desc' }
  ],
  take: limit,
});
*/

-- ============================================
-- 7. 監控分頁查詢效能
-- ============================================

-- 查看使用 OFFSET 的慢查詢
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%OFFSET%'
  AND query LIKE '%LIMIT%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- ============================================
-- 8. 遷移現有分頁查詢的步驟
-- ============================================

-- 1. 識別所有使用 OFFSET 的查詢
-- 2. 檢查這些查詢的執行時間
-- 3. 如果 OFFSET > 100，考慮改為游標分頁
-- 4. 建立適當的索引
-- 5. 更新 API 端點支援游標分頁
-- 6. 更新前端使用游標分頁









