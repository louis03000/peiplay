-- ============================================
-- Peiplay 全面效能優化索引腳本
-- ============================================
-- 此腳本添加所有必要的索引以優化查詢效能
-- 執行前請先備份資料庫

-- ============================================
-- 1. Partner 表索引優化
-- ============================================

-- 複合索引：status + isAvailableNow（常用篩選組合）
CREATE INDEX IF NOT EXISTS "idx_partner_status_available" ON "Partner"("status", "isAvailableNow");

-- 複合索引：status + isRankBooster（排行榜查詢）
CREATE INDEX IF NOT EXISTS "idx_partner_status_rankbooster" ON "Partner"("status", "isRankBooster");

-- 複合索引：status + createdAt（列表排序）
CREATE INDEX IF NOT EXISTS "idx_partner_status_created" ON "Partner"("status", "createdAt" DESC);

-- 索引：userId（已存在，但確保存在）
CREATE INDEX IF NOT EXISTS "idx_partner_userId" ON "Partner"("userId");

-- 索引：inviteCode（邀請碼查詢）
CREATE INDEX IF NOT EXISTS "idx_partner_inviteCode" ON "Partner"("inviteCode") WHERE "inviteCode" IS NOT NULL;

-- ============================================
-- 2. Schedule 表索引優化
-- ============================================

-- 複合索引：partnerId + date + isAvailable（最常用查詢）
CREATE INDEX IF NOT EXISTS "idx_schedule_partner_date_available" ON "Schedule"("partnerId", "date", "isAvailable");

-- 複合索引：date + isAvailable（日期範圍查詢）
CREATE INDEX IF NOT EXISTS "idx_schedule_date_available" ON "Schedule"("date", "isAvailable");

-- 複合索引：partnerId + date + startTime（時段排序）
CREATE INDEX IF NOT EXISTS "idx_schedule_partner_date_start" ON "Schedule"("partnerId", "date", "startTime");

-- 複合索引：date + startTime + endTime（時間範圍查詢）
CREATE INDEX IF NOT EXISTS "idx_schedule_date_time_range" ON "Schedule"("date", "startTime", "endTime");

-- 索引：endTime（查詢未結束的預約）
CREATE INDEX IF NOT EXISTS "idx_schedule_endTime" ON "Schedule"("endTime");

-- ============================================
-- 3. Booking 表索引優化
-- ============================================

-- 複合索引：customerId + status（用戶預約查詢）
CREATE INDEX IF NOT EXISTS "idx_booking_customer_status" ON "Booking"("customerId", "status");

-- 複合索引：customerId + createdAt（用戶預約列表排序）
CREATE INDEX IF NOT EXISTS "idx_booking_customer_created" ON "Booking"("customerId", "createdAt" DESC);

-- 複合索引：scheduleId + status（時段預約查詢）
CREATE INDEX IF NOT EXISTS "idx_booking_schedule_status" ON "Booking"("scheduleId", "status");

-- 複合索引：status + createdAt（狀態查詢 + 排序）
CREATE INDEX IF NOT EXISTS "idx_booking_status_created" ON "Booking"("status", "createdAt" DESC);

-- 複合索引：multiPlayerBookingId + status（多人預約查詢）
CREATE INDEX IF NOT EXISTS "idx_booking_multiplayer_status" ON "Booking"("multiPlayerBookingId", "status") WHERE "multiPlayerBookingId" IS NOT NULL;

-- 索引：groupBookingId（群組預約查詢）
CREATE INDEX IF NOT EXISTS "idx_booking_groupBookingId" ON "Booking"("groupBookingId") WHERE "groupBookingId" IS NOT NULL;

-- 複合索引：status + updatedAt（狀態更新查詢）
CREATE INDEX IF NOT EXISTS "idx_booking_status_updated" ON "Booking"("status", "updatedAt" DESC);

-- ============================================
-- 4. User 表索引優化
-- ============================================

-- 索引：email（已存在 unique，但確保查詢優化）
-- email 已經是 unique index，不需要額外索引

-- 複合索引：isSuspended + suspensionEndsAt（停權查詢）
CREATE INDEX IF NOT EXISTS "idx_user_suspended" ON "User"("isSuspended", "suspensionEndsAt");

-- 索引：role（角色查詢）
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "User"("role");

-- ============================================
-- 5. Customer 表索引優化
-- ============================================

-- 索引：userId（已存在，確保存在）
CREATE INDEX IF NOT EXISTS "idx_customer_userId" ON "Customer"("userId");

-- 索引：lineId（LINE ID 查詢）
CREATE INDEX IF NOT EXISTS "idx_customer_lineId" ON "Customer"("lineId") WHERE "lineId" IS NOT NULL;

-- ============================================
-- 6. FavoritePartner 表索引優化
-- ============================================

-- 複合索引：customerId + createdAt（最愛列表排序）
CREATE INDEX IF NOT EXISTS "idx_favorite_customer_created" ON "FavoritePartner"("customerId", "createdAt" DESC);

-- 索引：partnerId（夥伴被收藏次數查詢）
CREATE INDEX IF NOT EXISTS "idx_favorite_partnerId" ON "FavoritePartner"("partnerId");

-- ============================================
-- 7. PersonalNotification 表索引優化
-- ============================================

-- 複合索引：userId + isRead + createdAt（通知列表查詢）
CREATE INDEX IF NOT EXISTS "idx_personal_notification_user_read_created" ON "PersonalNotification"("userId", "isRead", "createdAt" DESC);

-- 複合索引：userId + isImportant + createdAt（重要通知優先）
CREATE INDEX IF NOT EXISTS "idx_personal_notification_user_important_created" ON "PersonalNotification"("userId", "isImportant", "createdAt" DESC);

-- 複合索引：userId + expiresAt（過期通知過濾）
CREATE INDEX IF NOT EXISTS "idx_personal_notification_user_expires" ON "PersonalNotification"("userId", "expiresAt") WHERE "expiresAt" IS NOT NULL;

-- ============================================
-- 8. Announcement 表索引優化
-- ============================================

-- 複合索引：isActive + expiresAt + createdAt（公告列表查詢）
CREATE INDEX IF NOT EXISTS "idx_announcement_active_expires_created" ON "Announcement"("isActive", "expiresAt", "createdAt" DESC);

-- 複合索引：isActive + createdAt（活躍公告排序）
CREATE INDEX IF NOT EXISTS "idx_announcement_active_created" ON "Announcement"("isActive", "createdAt" DESC);

-- ============================================
-- 9. Review 表索引優化
-- ============================================

-- 複合索引：revieweeId + isApproved（評價查詢）
CREATE INDEX IF NOT EXISTS "idx_review_reviewee_approved" ON "Review"("revieweeId", "isApproved");

-- 複合索引：bookingId + reviewerId（預約評價查詢）
CREATE INDEX IF NOT EXISTS "idx_review_booking_reviewer" ON "Review"("bookingId", "reviewerId");

-- 索引：rating（評分查詢）
CREATE INDEX IF NOT EXISTS "idx_review_rating" ON "Review"("rating");

-- ============================================
-- 10. ChatMessage 表索引優化
-- ============================================

-- 複合索引：roomId + createdAt（聊天訊息查詢）
CREATE INDEX IF NOT EXISTS "idx_chat_message_room_created" ON "ChatMessage"("roomId", "createdAt" DESC);

-- 複合索引：senderId + createdAt（發送者訊息查詢）
CREATE INDEX IF NOT EXISTS "idx_chat_message_sender_created" ON "ChatMessage"("senderId", "createdAt" DESC);

-- 複合索引：moderationStatus + createdAt（審查查詢）
CREATE INDEX IF NOT EXISTS "idx_chat_message_moderation_created" ON "ChatMessage"("moderationStatus", "createdAt" DESC);

-- ============================================
-- 11. ChatRoom 表索引優化
-- ============================================

-- 複合索引：bookingId + type（預約聊天室查詢）
CREATE INDEX IF NOT EXISTS "idx_chat_room_booking_type" ON "ChatRoom"("bookingId", "type") WHERE "bookingId" IS NOT NULL;

-- 索引：lastMessageAt（最近訊息排序）
CREATE INDEX IF NOT EXISTS "idx_chat_room_lastMessage" ON "ChatRoom"("lastMessageAt" DESC) WHERE "lastMessageAt" IS NOT NULL;

-- ============================================
-- 12. ChatRoomMember 表索引優化
-- ============================================

-- 複合索引：userId + isActive（用戶活躍聊天室）
CREATE INDEX IF NOT EXISTS "idx_chat_member_user_active" ON "ChatRoomMember"("userId", "isActive");

-- 複合索引：roomId + userId（聊天室成員查詢）
-- 已有 unique constraint，但確保索引存在

-- ============================================
-- 13. MultiPlayerBooking 表索引優化
-- ============================================

-- 複合索引：customerId + status（用戶多人預約查詢）
CREATE INDEX IF NOT EXISTS "idx_multiplayer_customer_status" ON "MultiPlayerBooking"("customerId", "status");

-- 複合索引：status + createdAt（多人預約列表排序）
CREATE INDEX IF NOT EXISTS "idx_multiplayer_status_created" ON "MultiPlayerBooking"("status", "createdAt" DESC);

-- 複合索引：date + startTime + endTime（時間範圍查詢）
CREATE INDEX IF NOT EXISTS "idx_multiplayer_date_time" ON "MultiPlayerBooking"("date", "startTime", "endTime");

-- ============================================
-- 14. GroupBooking 表索引優化
-- ============================================

-- 複合索引：status + createdAt（群組預約列表排序）
CREATE INDEX IF NOT EXISTS "idx_group_booking_status_created" ON "GroupBooking"("status", "createdAt" DESC);

-- 複合索引：date + startTime + endTime（時間範圍查詢）
CREATE INDEX IF NOT EXISTS "idx_group_booking_date_time" ON "GroupBooking"("date", "startTime", "endTime");

-- ============================================
-- 15. RankingHistory 表索引優化
-- ============================================

-- 複合索引：weekStartDate + rank（週排行榜查詢）
CREATE INDEX IF NOT EXISTS "idx_ranking_week_rank" ON "RankingHistory"("weekStartDate", "rank");

-- 複合索引：partnerId + weekStartDate（夥伴歷史排名）
CREATE INDEX IF NOT EXISTS "idx_ranking_partner_week" ON "RankingHistory"("partnerId", "weekStartDate" DESC);

-- ============================================
-- 16. WithdrawalRequest 表索引優化
-- ============================================

-- 複合索引：partnerId + status + requestedAt（提現查詢）
CREATE INDEX IF NOT EXISTS "idx_withdrawal_partner_status_requested" ON "WithdrawalRequest"("partnerId", "status", "requestedAt" DESC);

-- ============================================
-- 17. PromoCode 表索引優化
-- ============================================

-- 複合索引：isActive + validFrom + validUntil（有效優惠碼查詢）
CREATE INDEX IF NOT EXISTS "idx_promo_active_valid" ON "PromoCode"("isActive", "validFrom", "validUntil");

-- 複合索引：partnerId + isActive（夥伴專屬優惠碼）
CREATE INDEX IF NOT EXISTS "idx_promo_partner_active" ON "PromoCode"("partnerId", "isActive") WHERE "partnerId" IS NOT NULL;

-- ============================================
-- 18. AdminMessage 表索引優化
-- ============================================

-- 複合索引：userId + isRead + createdAt（管理員訊息查詢）
CREATE INDEX IF NOT EXISTS "idx_admin_message_user_read_created" ON "AdminMessage"("userId", "isRead", "createdAt" DESC);

-- ============================================
-- 索引建立完成
-- ============================================

-- 顯示所有建立的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

