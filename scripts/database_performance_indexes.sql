-- ============================================
-- PeiPlay 資料庫效能優化索引腳本
-- ============================================
-- 此腳本包含所有必要的索引，用於優化查詢效能
-- 執行前請先備份資料庫
-- ============================================

-- 啟用必要的 PostgreSQL 擴展
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- 用於模糊搜尋

-- ============================================
-- 1. User 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_phone ON "User"(phone) WHERE phone IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_created ON "User"(role, "createdAt" DESC);

-- ============================================
-- 2. Partner 表索引優化（文字搜尋）
-- ============================================
-- Full-text search index for partner name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_name_gin 
ON "Partner" USING gin (to_tsvector('english', name));

-- Trigram index for LIKE searches (模糊搜尋)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_name_trgm 
ON "Partner" USING gin (name gin_trgm_ops);

-- 複合索引優化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_status_verified 
ON "Partner"(status, "idVerificationStatus") 
WHERE status = 'APPROVED' AND "idVerificationStatus" = 'APPROVED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_hourly_rate 
ON "Partner"("halfHourlyRate") 
WHERE status = 'APPROVED';

-- ============================================
-- 3. Booking 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_partner_startat 
ON "Booking"("partnerId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_user_status_created 
ON "Booking"("customerId", status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_partner_status 
ON "Booking"("partnerId", status, "createdAt" DESC);

-- 用於查詢活躍預約
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_active_statuses 
ON "Booking"(status, "createdAt") 
WHERE status IN ('PENDING', 'CONFIRMED', 'PAID_WAITING_PARTNER_CONFIRMATION', 'PARTNER_ACCEPTED');

-- ============================================
-- 4. Schedule 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_partner_date_range 
ON "Schedule"("partnerId", date, "startTime", "endTime") 
WHERE "isAvailable" = true;

-- ============================================
-- 5. Payment 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_provider_status 
ON "Payment"(provider, status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_booking_status 
ON "Payment"("bookingId", status);

-- ============================================
-- 6. KYC 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_status_created 
ON "KYC"(status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kyc_pending_review 
ON "KYC"(status, "createdAt") 
WHERE status IN ('PENDING', 'IN_REVIEW');

-- ============================================
-- 7. PartnerVerification 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_verification_status_created 
ON "PartnerVerification"(status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_verification_pending 
ON "PartnerVerification"(status, "createdAt") 
WHERE status IN ('PENDING', 'IN_REVIEW');

-- ============================================
-- 8. RefundRequest 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refund_status_created 
ON "RefundRequest"(status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refund_user_status 
ON "RefundRequest"("userId", status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refund_partner_status 
ON "RefundRequest"("partnerId", status, "createdAt" DESC) 
WHERE "partnerId" IS NOT NULL;

-- ============================================
-- 9. SupportTicket 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_status_created 
ON "SupportTicket"(status, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_ticket_user_status 
ON "SupportTicket"("userId", status, "createdAt" DESC);

-- ============================================
-- 10. Review 表索引優化
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_reviewee_approved 
ON "Review"("revieweeId", "isApproved", "createdAt" DESC) 
WHERE "isApproved" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_rating_approved 
ON "Review"(rating, "isApproved") 
WHERE "isApproved" = true;

-- ============================================
-- 11. LogEntry 表索引優化（審計日誌）
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_entry_action_created 
ON "LogEntry"(action, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_entry_resource 
ON "LogEntry"("resourceType", "resourceId", "createdAt" DESC);

-- 用於查詢特定時間範圍的日誌
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_entry_created_range 
ON "LogEntry"("createdAt" DESC) 
WHERE "createdAt" > NOW() - INTERVAL '30 days';

-- ============================================
-- 12. 複合查詢優化索引
-- ============================================
-- 首頁熱門夥伴查詢（已驗證 + 有評分）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_homepage 
ON "Partner"(status, "idVerificationStatus", "createdAt" DESC) 
WHERE status = 'APPROVED' AND "idVerificationStatus" = 'APPROVED';

-- ============================================
-- 索引使用情況檢查查詢（執行後可運行）
-- ============================================
-- 檢查未使用的索引：
-- SELECT schemaname, tablename, indexname, idx_scan 
-- FROM pg_stat_user_indexes 
-- WHERE idx_scan = 0 AND schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- 檢查索引大小：
-- SELECT schemaname, tablename, indexname, 
--        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

