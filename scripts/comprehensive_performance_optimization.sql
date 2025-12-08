-- ============================================
-- Peiplay 全面效能優化腳本
-- ============================================
-- 目的：一次性添加所有必要的索引以提升整體 API 效能
-- 
-- ⚠️ 重要提醒：
-- 1. 請先備份資料庫
-- 2. 建議在非生產環境先測試
-- 3. 在低峰時段執行
-- 4. 執行後請監控查詢效能
--
-- ============================================

-- ========== 1. Booking 表索引優化 ==========

-- 優化查詢：customerId + createdAt DESC
-- 用於 bookings/me API 和客戶預約列表
CREATE INDEX IF NOT EXISTS "Booking_customerId_createdAt_desc_idx" 
ON "Booking"("customerId", "createdAt" DESC);

-- 優化查詢：scheduleId + status
-- 用於判斷時段是否有活躍預約（已存在，但確保存在）
CREATE INDEX IF NOT EXISTS "Booking_scheduleId_status_idx" 
ON "Booking"("scheduleId", "status");

-- ========== 2. Schedule 表索引優化 ==========

-- 優化查詢：partnerId + date + isAvailable
-- 用於夥伴列表和詳情頁（已存在，但確保存在）
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_date_isAvailable_idx" 
ON "Schedule"("partnerId", "date", "isAvailable");

-- 優化查詢：date + isAvailable
-- 用於按日期查詢可用時段（已存在，但確保存在）
CREATE INDEX IF NOT EXISTS "Schedule_date_isAvailable_idx" 
ON "Schedule"("date", "isAvailable");

-- 優化查詢：partnerId + startTime + isAvailable
-- 用於夥伴詳情頁面
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_startTime_isAvailable_idx" 
ON "Schedule"("partnerId", "startTime", "isAvailable");

-- 優化查詢：endTime（用於過濾已結束的預約）
CREATE INDEX IF NOT EXISTS "Schedule_endTime_idx" 
ON "Schedule"("endTime");

-- ========== 3. Partner 表索引優化 ==========

-- 所有必要的索引應該已存在，這裡確保它們存在
CREATE INDEX IF NOT EXISTS "Partner_status_idx" ON "Partner"("status");
CREATE INDEX IF NOT EXISTS "Partner_status_isAvailableNow_idx" ON "Partner"("status", "isAvailableNow");
CREATE INDEX IF NOT EXISTS "Partner_status_isRankBooster_idx" ON "Partner"("status", "isRankBooster");
CREATE INDEX IF NOT EXISTS "Partner_userId_idx" ON "Partner"("userId");

-- ========== 4. User 表索引優化 ==========

-- 優化查詢：isSuspended + suspensionEndsAt
-- 用於過濾被停權的用戶
CREATE INDEX IF NOT EXISTS "User_isSuspended_suspensionEndsAt_idx" 
ON "User"("isSuspended", "suspensionEndsAt");

-- ========== 5. PersonalNotification 表索引優化 ==========

-- 優化查詢：userId + isRead + createdAt DESC
-- 用於個人通知列表（已存在，但確保存在）
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isRead_createdAt_idx" 
ON "PersonalNotification"("userId", "isRead", "createdAt" DESC);

-- 優化查詢：userId + isImportant + priority + createdAt
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isImportant_priority_createdAt_idx" 
ON "PersonalNotification"("userId", "isImportant", "priority" DESC, "createdAt" DESC);

-- ========== 6. FavoritePartner 表索引優化 ==========

-- 優化查詢：customerId + createdAt DESC
-- 用於最愛列表查詢
CREATE INDEX IF NOT EXISTS "FavoritePartner_customerId_createdAt_idx" 
ON "FavoritePartner"("customerId", "createdAt" DESC);

-- ========== 7. Announcement 表索引優化 ==========

-- 優化查詢：isActive + createdAt DESC
-- 用於公告列表查詢
CREATE INDEX IF NOT EXISTS "Announcement_isActive_createdAt_idx" 
ON "Announcement"("isActive", "createdAt" DESC);

-- 優化查詢：isActive + expiresAt + createdAt
CREATE INDEX IF NOT EXISTS "Announcement_isActive_expiresAt_createdAt_idx" 
ON "Announcement"("isActive", "expiresAt" NULLS FIRST, "createdAt" DESC);

-- ========== 8. GroupBooking 表索引優化 ==========

-- 優化查詢：status + date + startTime
-- 用於群組預約列表查詢
CREATE INDEX IF NOT EXISTS "GroupBooking_status_date_startTime_idx" 
ON "GroupBooking"("status", "date", "startTime");

-- 優化查詢：initiatorId + initiatorType + status
-- 用於查詢特定發起者的群組預約
CREATE INDEX IF NOT EXISTS "GroupBooking_initiatorId_initiatorType_status_idx" 
ON "GroupBooking"("initiatorId", "initiatorType", "status");

-- ========== 9. MultiPlayerBooking 表索引優化 ==========

-- 優化查詢：customerId + status + createdAt DESC
-- 用於多人陪玩列表查詢
CREATE INDEX IF NOT EXISTS "MultiPlayerBooking_customerId_status_createdAt_idx" 
ON "MultiPlayerBooking"("customerId", "status", "createdAt" DESC);

-- ========== 10. Review 表索引優化 ==========

-- 優化查詢：isApproved + createdAt DESC
-- 用於評價列表查詢
CREATE INDEX IF NOT EXISTS "Review_isApproved_createdAt_desc_idx" 
ON "Review"("isApproved", "createdAt" DESC);

-- ========== 執行後檢查 ==========
-- 執行以下查詢確認索引已創建：

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'Booking', 'Schedule', 'Partner', 'User', 
        'PersonalNotification', 'FavoritePartner', 'Announcement',
        'GroupBooking', 'MultiPlayerBooking', 'Review'
    )
ORDER BY tablename, indexname;

-- ========== 檢查索引使用情況 ==========
-- 執行以下查詢查看索引使用統計：

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "使用次數",
    pg_size_pretty(pg_relation_size(indexrelid)) as "索引大小"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'Booking', 'Schedule', 'Partner', 'User', 
        'PersonalNotification', 'FavoritePartner', 'Announcement',
        'GroupBooking', 'MultiPlayerBooking', 'Review'
    )
ORDER BY idx_scan DESC, tablename, indexname;

