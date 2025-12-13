-- ============================================
-- EXPLAIN ANALYZE 查詢檢查腳本
-- 用於診斷資料庫查詢效能問題
-- ============================================

-- 1. 檢查 partners API 查詢
-- 模擬 /api/partners 的主要查詢
EXPLAIN ANALYZE
SELECT 
  p.id,
  p.name,
  p.games,
  p."halfHourlyRate",
  p."coverImage",
  p.images,
  p."rankBoosterImages",
  p."isAvailableNow",
  p."isRankBooster",
  p."allowGroupBooking",
  p."rankBoosterNote",
  p."rankBoosterRank",
  p."customerMessage",
  p."supportsChatOnly",
  p."chatOnlyRate",
  u."isSuspended",
  u."suspensionEndsAt"
FROM "Partner" p
JOIN "User" u ON p."userId" = u.id
WHERE p.status = 'APPROVED'
  AND (u."isSuspended" = false OR (u."isSuspended" = true AND u."suspensionEndsAt" <= NOW()))
ORDER BY p."createdAt" DESC
LIMIT 50;

-- 2. 檢查 schedules 查詢（partners API 中的嵌套查詢）
EXPLAIN ANALYZE
SELECT 
  s.id,
  s.date,
  s."startTime",
  s."endTime",
  s."isAvailable",
  b.status as booking_status
FROM "Schedule" s
LEFT JOIN "Booking" b ON s.id = b."scheduleId"
WHERE s."partnerId" IN (
  SELECT id FROM "Partner" WHERE status = 'APPROVED' LIMIT 50
)
  AND s."isAvailable" = true
  AND s.date >= CURRENT_DATE
ORDER BY s.date ASC, s."startTime" ASC
LIMIT 2500; -- 50 partners * 50 schedules

-- 3. 檢查 bookings/me API 查詢
EXPLAIN ANALYZE
SELECT 
  b.id,
  b.status,
  b."createdAt",
  b."rejectReason",
  s.date,
  s."startTime",
  s."endTime",
  p.id as partner_id,
  p.name as partner_name,
  p."userId" as partner_user_id
FROM "Booking" b
JOIN "Schedule" s ON b."scheduleId" = s.id
JOIN "Partner" p ON s."partnerId" = p.id
WHERE b."customerId" = (
  SELECT id FROM "Customer" WHERE "userId" = 'xxx' LIMIT 1
)
ORDER BY b."createdAt" DESC
LIMIT 30;

-- 4. 檢查 partners/search-by-time API 查詢
EXPLAIN ANALYZE
SELECT 
  p.id,
  p.name,
  p.games,
  p."halfHourlyRate",
  p."coverImage",
  u.email,
  u.discord,
  u."isSuspended",
  u."suspensionEndsAt"
FROM "Partner" p
JOIN "User" u ON p."userId" = u.id
WHERE p.status = 'APPROVED'
  AND EXISTS (
    SELECT 1
    FROM "Schedule" s
    WHERE s."partnerId" = p.id
      AND s.date >= '2025-01-01'
      AND s.date <= '2025-01-07'
      AND s."startTime" <= '10:00:00'
      AND s."endTime" >= '12:00:00'
      AND s."isAvailable" = true
  )
  AND (p.games @> ARRAY['lol'] OR p.games IS NULL);

-- 5. 檢查 reviews API 查詢
EXPLAIN ANALYZE
SELECT 
  r.id,
  r."bookingId",
  r."reviewerId",
  r."revieweeId",
  r.rating,
  r.comment,
  r."isApproved",
  r."createdAt",
  r."approvedAt"
FROM "Review" r
WHERE r."revieweeId" = 'xxx'
ORDER BY r."createdAt" DESC
LIMIT 100;

-- 6. 檢查是否有全表掃描
-- 查看所有沒有使用索引的查詢
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- 從未使用過的索引
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. 檢查表掃描統計
SELECT 
  schemaname,
  tablename,
  seq_scan as sequential_scans,
  seq_tup_read as sequential_tuples_read,
  idx_scan as index_scans,
  idx_tup_fetch as index_tuples_fetched,
  CASE 
    WHEN seq_scan + idx_scan > 0 
    THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
    ELSE 0 
  END as index_usage_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- 8. 檢查慢查詢（需要啟用 pg_stat_statements）
-- 注意：需要先執行 CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 20;

