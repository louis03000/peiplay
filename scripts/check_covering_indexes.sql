-- ============================================
-- 覆蓋索引（Covering Index）優化檢查腳本
-- ============================================
-- 根據文章建議，檢查並優化覆蓋索引使用
-- ============================================

-- ============================================
-- 1. 什麼是覆蓋索引？
-- ============================================
-- 當 SELECT 的欄位都包含在使用的索引中時，
-- PostgreSQL 就不需要回原表取資料，這就是覆蓋索引。
-- Extra 欄位會顯示 "Index Only Scan"

-- ============================================
-- 2. 檢查現有查詢是否可以使用覆蓋索引
-- ============================================

-- 2.1 分析查詢，檢查是否需要回表
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, status, "createdAt"
FROM "Booking"
WHERE "customerId" = 'YOUR_CUSTOMER_ID'
ORDER BY "createdAt" DESC
LIMIT 10;

-- 如果執行計劃顯示 "Index Only Scan"，表示使用了覆蓋索引
-- 如果顯示 "Index Scan"，表示需要回表查詢

-- ============================================
-- 3. 建立覆蓋索引（PostgreSQL 使用 INCLUDE）
-- ============================================

-- 3.1 Booking 表覆蓋索引
-- 用於：SELECT id, status, "createdAt" WHERE customerId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_booking_customer_created_covering" 
ON "Booking"("customerId", "createdAt" DESC)
INCLUDE (id, status, "finalAmount");

-- 3.2 Partner 表覆蓋索引
-- 用於：SELECT id, name, games, "halfHourlyRate" WHERE status = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_partner_status_created_covering" 
ON "Partner"("status", "createdAt" DESC)
INCLUDE (id, name, games, "halfHourlyRate", "isAvailableNow", "isRankBooster");

-- 3.3 Schedule 表覆蓋索引
-- 用於：SELECT id, date, "startTime", "endTime" WHERE partnerId = ? AND date >= ?
CREATE INDEX IF NOT EXISTS "idx_schedule_partner_date_covering" 
ON "Schedule"("partnerId", date, "startTime")
INCLUDE (id, "endTime", "isAvailable");

-- 3.4 PersonalNotification 表覆蓋索引
-- 用於：SELECT id, title, content, type, "isRead", "createdAt" WHERE userId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_personal_notification_user_created_covering" 
ON "PersonalNotification"("userId", "createdAt" DESC)
INCLUDE (id, title, content, type, "isRead", "isImportant", "expiresAt");

-- 3.5 Announcement 表覆蓋索引
-- 用於：SELECT id, title, content, type, "createdAt" WHERE isActive = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "idx_announcement_active_created_covering" 
ON "Announcement"("isActive", "createdAt" DESC)
INCLUDE (id, title, content, type, "expiresAt");

-- ============================================
-- 4. 檢查索引大小
-- ============================================

-- 覆蓋索引會比普通索引大，需要權衡空間和效能
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%covering%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 5. 優化原則
-- ============================================

-- 5.1 避免 SELECT *
-- ❌ 錯誤：SELECT * FROM "Partner" WHERE status = 'APPROVED'
-- ✅ 正確：SELECT id, name, games FROM "Partner" WHERE status = 'APPROVED'

-- 5.2 只選擇需要的欄位
-- 這樣可以增加使用覆蓋索引的機會

-- 5.3 檢查查詢模式
-- 如果某個查詢經常執行且只選擇特定欄位，考慮建立覆蓋索引

-- ============================================
-- 6. 驗證覆蓋索引效果
-- ============================================

-- 6.1 建立索引前後對比
-- 執行 EXPLAIN ANALYZE 查看：
-- - Index Only Scan: 使用覆蓋索引（最佳）
-- - Index Scan: 使用索引但需要回表
-- - Seq Scan: 全表掃描（最差）

-- 6.2 檢查緩衝區使用
-- 覆蓋索引可以減少緩衝區讀取，提升效能

-- ============================================
-- 7. 注意事項
-- ============================================

-- 1. 覆蓋索引會增加索引大小，需要更多儲存空間
-- 2. 寫入效能會稍微降低（因為需要更新更多索引）
-- 3. 只對頻繁讀取的查詢建立覆蓋索引
-- 4. 定期檢查索引使用情況，刪除未使用的索引






