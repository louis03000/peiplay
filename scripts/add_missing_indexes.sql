-- ============================================
-- 添加缺失的效能優化索引
-- 執行前請先備份資料庫
-- ============================================

-- 1. 為 games 陣列添加 GIN index（如果資料量大且需要陣列查詢）
-- 注意：GIN index 會增加寫入時間，只在需要時添加
CREATE INDEX IF NOT EXISTS idx_partner_games_gin 
ON "Partner" USING GIN (games);

-- 驗證索引
-- EXPLAIN ANALYZE SELECT * FROM "Partner" WHERE games @> ARRAY['lol'];

-- 2. 優化 partners 查詢的複合索引（如果不存在）
-- 檢查現有索引是否足夠
-- 如果查詢經常使用 status + isAvailableNow + createdAt，確保有對應索引

-- 3. 優化 schedules 查詢
-- 檢查是否需要添加 date + isAvailable + startTime 的複合索引
CREATE INDEX IF NOT EXISTS idx_schedule_date_available_starttime 
ON "Schedule" (date, "isAvailable", "startTime")
WHERE "isAvailable" = true;

-- 4. 優化 bookings 查詢
-- 如果經常查詢特定狀態的預約，考慮添加部分索引
CREATE INDEX IF NOT EXISTS idx_booking_active_status 
ON "Booking" ("customerId", "createdAt" DESC)
WHERE status IN ('PENDING', 'CONFIRMED', 'PARTNER_ACCEPTED', 'PAID_WAITING_PARTNER_CONFIRMATION');

-- 5. 優化 reviews 查詢
-- 如果經常查詢已批准的評價
CREATE INDEX IF NOT EXISTS idx_review_approved_created 
ON "Review" ("revieweeId", "createdAt" DESC)
WHERE "isApproved" = true;

-- 6. 檢查索引使用情況
-- 執行後檢查哪些索引被使用
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 7. 檢查索引大小
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

