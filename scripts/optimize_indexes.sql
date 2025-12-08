-- ============================================
-- Peiplay 資料庫索引優化腳本
-- ============================================
-- 目的：刪除不必要的索引以提升資料庫寫入效能和查詢速度
-- 
-- ⚠️ 重要提醒：
-- 1. 請先執行 scripts/analyze_indexes.sql 分析索引使用情況
-- 2. 建議在非生產環境先測試
-- 3. 執行前請備份資料庫
-- 4. 建議在低峰時段執行
--
-- ============================================

-- ========== 1. Schedule 表索引優化 ==========
-- 分析：
--   - 查詢模式：partnerId + date + isAvailable（最常見，用於夥伴列表和詳情頁）
--   - 查詢模式：date + isAvailable（按日期查詢可用時段）
--   - 查詢模式：partnerId + date（按夥伴和日期查詢）
--   - 查詢模式：partnerId + startTime + isAvailable（夥伴詳情頁）
--
-- 優化：
--   - 保留：Schedule_partnerId_date_isAvailable_idx（最完整，覆蓋大部分查詢）
--   - 保留：Schedule_date_isAvailable_idx（按日期查詢）
--   - 保留：Schedule_partnerId_startTime_isAvailable_idx（夥伴詳情頁）
--   - 刪除：Schedule_partnerId_date_idx（被 Schedule_partnerId_date_isAvailable_idx 覆蓋）
--   - 刪除：Schedule_partnerId_isAvailable_idx（不常見的查詢模式，且可被其他索引覆蓋）

DROP INDEX IF EXISTS "Schedule_partnerId_date_idx";
DROP INDEX IF EXISTS "Schedule_partnerId_isAvailable_idx";

-- ========== 2. Booking 表索引優化 ==========
-- 分析：
--   - scheduleId 是 UNIQUE 欄位，PostgreSQL 會自動創建唯一索引
--   - 查詢模式：customerId + createdAt DESC（客戶預約列表）
--   - 查詢模式：scheduleId + status（判斷時段是否有活躍預約）
--   - 查詢模式：status + createdAt DESC（管理員查詢）
--   - 查詢模式：customerId + status（客戶特定狀態的預約）
--
-- 優化：
--   - 保留：Booking_scheduleId_status_idx（判斷活躍預約）
--   - 保留：Booking_customerId_createdAt_idx（客戶預約列表，但需要改為 DESC）
--   - 保留：Booking_customerId_status_idx（客戶特定狀態查詢）
--   - 保留：Booking_status_createdAt_desc_idx（管理員查詢）
--   - 刪除：Booking_scheduleId_idx（scheduleId 是 unique，已有唯一索引，且已有 scheduleId + status 索引）

DROP INDEX IF EXISTS "Booking_scheduleId_idx";

-- 注意：如果 Booking_customerId_createdAt_idx 不是降序，需要重建
-- 但為了安全，這裡不自動重建，請手動檢查

-- ========== 3. Partner 表索引優化 ==========
-- 分析：
--   - 查詢模式：status（最常見，查詢已批准的夥伴）
--   - 查詢模式：status + isAvailableNow（現在有空）
--   - 查詢模式：status + isRankBooster（上分高手）
--   - 查詢模式：userId（通過用戶 ID 查找夥伴）
--
-- 優化：
--   - 所有索引都是必要的，保留所有索引
--   - Partner_status_idx（單獨查詢 status 很常見）
--   - Partner_status_isAvailableNow_idx（現在有空查詢）
--   - Partner_status_isRankBooster_idx（上分高手查詢）
--   - Partner_userId_idx（用戶關聯查詢）

-- 不刪除任何索引

-- ========== 4. WithdrawalRequest 表索引優化 ==========
-- 分析：
--   - 查詢模式：partnerId + status（夥伴的提現請求）
--   - 查詢模式：partnerId + requestedAt（按時間排序）
--
-- 優化：
--   - 保留：WithdrawalRequest_partnerId_status_idx（最常用）
--   - 保留：WithdrawalRequest_partnerId_requestedAt_idx（按時間排序）
--   - 刪除：WithdrawalRequest_partnerId_idx（被其他兩個索引覆蓋）

DROP INDEX IF EXISTS "WithdrawalRequest_partnerId_idx";

-- ========== 5. ChatRoom 表索引優化 ==========
-- 分析：
--   - 查詢模式：bookingId（通過預約查找聊天室）
--   - 查詢模式：groupBookingId（群組預約聊天室）
--   - 查詢模式：multiPlayerBookingId（多人預約聊天室）
--   - 查詢模式：lastMessageAt DESC（聊天室列表排序）
--
-- 優化：
--   - 所有索引都是必要的，但 lastMessageAt 索引可能使用率低
--   - 如果聊天室列表不常按最後訊息時間排序，可以刪除
--   - 建議先檢查使用情況再決定

-- DROP INDEX IF EXISTS "ChatRoom_lastMessageAt_desc_idx";  -- 請先檢查使用情況

-- ========== 6. ChatMessage 表索引優化 ==========
-- 分析：
--   - 查詢模式：roomId + createdAt（聊天室訊息列表）
--   - 查詢模式：roomId + moderationStatus + createdAt（未讀訊息）
--   - 查詢模式：senderId（發送者查詢）
--
-- 優化：
--   - 保留：ChatMessage_roomId_createdAt_idx（基本查詢）
--   - 保留：ChatMessage_roomId_moderationStatus_createdAt_idx（未讀訊息）
--   - 刪除：ChatMessage_senderId_moderationStatus_idx（不常見的查詢模式）
--   - 保留：ChatMessage_senderId_idx（發送者查詢）

DROP INDEX IF EXISTS "ChatMessage_senderId_moderationStatus_idx";

-- ========== 7. Review 表索引優化 ==========
-- 分析：
--   - 查詢模式：isApproved + createdAt DESC（已審核評價列表）
--   - 查詢模式：revieweeId + isApproved + createdAt（特定用戶的評價）
--
-- 優化：
--   - 保留：Review_isApproved_createdAt_desc_idx（評價列表）
--   - 刪除：Review_revieweeId_isApproved_createdAt_idx（如果使用率低）

-- DROP INDEX IF EXISTS "Review_revieweeId_isApproved_createdAt_idx";  -- 請先檢查使用情況

-- ========== 8. GroupBooking 表索引優化 ==========
-- 分析：
--   - 查詢模式：status + date + startTime（活躍群組預約）
--   - 查詢模式：status（按狀態查詢）
--   - 查詢模式：date + startTime（按時間查詢）
--
-- 優化：
--   - 保留：GroupBooking_status_date_startTime_idx（最完整）
--   - 刪除：GroupBooking_status_idx（被複合索引覆蓋）
--   - 刪除：GroupBooking_date_startTime_idx（被複合索引覆蓋）

DROP INDEX IF EXISTS "GroupBooking_status_idx";
DROP INDEX IF EXISTS "GroupBooking_date_startTime_idx";

-- ========== 9. MultiPlayerBooking 表索引優化 ==========
-- 分析：
--   - 查詢模式：customerId + status + createdAt DESC（客戶的多人預約）
--   - 查詢模式：customerId（客戶的所有預約）
--   - 查詢模式：status（按狀態查詢）
--   - 查詢模式：date + startTime（按時間查詢）
--
-- 優化：
--   - 保留：MultiPlayerBooking_customerId_status_createdAt_idx（最完整）
--   - 刪除：MultiPlayerBooking_customerId_idx（被複合索引覆蓋）
--   - 刪除：MultiPlayerBooking_status_idx（被複合索引覆蓋）
--   - 刪除：MultiPlayerBooking_date_startTime_idx（被複合索引覆蓋）

DROP INDEX IF EXISTS "MultiPlayerBooking_customerId_idx";
DROP INDEX IF EXISTS "MultiPlayerBooking_status_idx";
DROP INDEX IF EXISTS "MultiPlayerBooking_date_startTime_idx";

-- ========== 10. Order 表索引優化 ==========
-- 分析：
--   - 查詢模式：customerId + createdAt DESC（客戶訂單列表）
--   - 查詢模式：bookingId（通過預約查找訂單，但通常通過 Booking 關聯查詢）
--
-- 優化：
--   - 保留：Order_customerId_createdAt_desc_idx（客戶訂單列表）
--   - 刪除：Order_bookingId_createdAt_idx（bookingId 通常通過 Booking 關聯查詢，不需要單獨索引）

DROP INDEX IF EXISTS "Order_bookingId_createdAt_idx";

-- ========== 11. PersonalNotification 表索引優化 ==========
-- 分析：
--   - 查詢模式：userId + isRead + createdAt DESC（未讀通知）
--   - 查詢模式：userId + isImportant + createdAt（重要通知）
--
-- 優化：
--   - 保留：PersonalNotification_userId_isRead_createdAt_idx（未讀通知）
--   - 刪除：PersonalNotification_userId_isImportant_createdAt_idx（如果使用率低）

-- DROP INDEX IF EXISTS "PersonalNotification_userId_isImportant_createdAt_idx";  -- 請先檢查使用情況

-- ========== 12. SecurityLog 表索引優化 ==========
-- 分析：
--   - SecurityLog 表可能有很多索引但使用率低
--   - 根據實際查詢模式決定保留哪些
--
-- 優化：
--   - 如果 ipAddress 查詢不常見，可以刪除
--   - 建議先檢查使用情況

-- DROP INDEX IF EXISTS "SecurityLog_ipAddress_timestamp_idx";  -- 請先檢查使用情況

-- ========== 執行後檢查 ==========
-- 執行以下查詢確認索引已刪除並查看剩餘索引：
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
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
ORDER BY idx_scan ASC, tablename, indexname;

