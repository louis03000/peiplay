-- 額外的效能優化索引
-- 這些索引將進一步提升查詢速度，特別針對常用查詢路徑

-- ========== 聊天系統優化索引 ==========

-- ChatRoomMember 表：優化按用戶查詢活躍聊天室
-- 用於 GET /api/chat/rooms 查詢用戶的聊天室列表
CREATE INDEX IF NOT EXISTS "ChatRoomMember_userId_isActive_idx" ON "ChatRoomMember"("userId", "isActive");

-- ChatMessage 表：優化按房間和審查狀態查詢
-- 用於查詢未讀訊息時過濾被拒絕的訊息
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_moderationStatus_createdAt_idx" ON "ChatMessage"("roomId", "moderationStatus", "createdAt" DESC);

-- ChatMessage 表：優化按發送者和審查狀態查詢
-- 用於批量查詢未讀訊息
-- 已移除：ChatMessage_senderId_moderationStatus_idx（不常見的查詢模式）
-- CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_moderationStatus_idx" ON "ChatMessage"("senderId", "moderationStatus");

-- ChatRoom 表：優化按最後訊息時間排序
-- 用於聊天室列表排序
CREATE INDEX IF NOT EXISTS "ChatRoom_lastMessageAt_desc_idx" ON "ChatRoom"("lastMessageAt" DESC NULLS LAST);

-- ========== Booking 表額外優化 ==========

-- 優化查詢特定客戶的預約（按時間排序）
-- 用於客戶預約列表查詢
CREATE INDEX IF NOT EXISTS "Booking_customerId_createdAt_desc_idx" ON "Booking"("customerId", "createdAt" DESC);

-- 優化查詢特定狀態的預約（按時間排序）
-- 用於管理員或統計查詢
CREATE INDEX IF NOT EXISTS "Booking_status_createdAt_desc_idx" ON "Booking"("status", "createdAt" DESC);

-- 優化查詢活躍預約（用於判斷夥伴是否忙碌）
-- 用於 /api/partners 查詢時排除有活躍預約的夥伴
CREATE INDEX IF NOT EXISTS "Booking_status_scheduleId_idx" ON "Booking"("status", "scheduleId");

-- ========== Schedule 表額外優化 ==========

-- 優化查詢未來的可用時段（按時間排序）
-- 用於 Dashboard 和夥伴列表查詢
CREATE INDEX IF NOT EXISTS "Schedule_date_startTime_isAvailable_idx" ON "Schedule"("date", "startTime", "isAvailable");

-- 優化查詢特定夥伴的未來時段
-- 用於夥伴詳情頁面
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_startTime_isAvailable_idx" ON "Schedule"("partnerId", "startTime", "isAvailable");

-- ========== User 表優化 ==========

-- 優化查詢未被停權的用戶
-- 用於過濾被停權的夥伴
CREATE INDEX IF NOT EXISTS "User_isSuspended_suspensionEndsAt_idx" ON "User"("isSuspended", "suspensionEndsAt");

-- ========== Notification 表優化 ==========

-- 優化查詢用戶的未讀通知
-- 用於通知列表查詢
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- ========== PersonalNotification 表優化 ==========

-- 優化查詢用戶的未讀個人通知
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isRead_createdAt_idx" ON "PersonalNotification"("userId", "isRead", "createdAt" DESC);

-- 優化查詢重要通知
-- 已移除：PersonalNotification_userId_isImportant_createdAt_idx（如果使用率低，請先檢查使用情況）
-- CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isImportant_createdAt_idx" ON "PersonalNotification"("userId", "isImportant", "createdAt" DESC);

-- ========== AdminMessage 表優化 ==========

-- 優化查詢用戶的管理員訊息（按時間排序）
CREATE INDEX IF NOT EXISTS "AdminMessage_userId_isRead_createdAt_idx" ON "AdminMessage"("userId", "isRead", "createdAt" DESC);

-- ========== Review 表優化 ==========

-- 優化查詢已審核的評價（按時間排序）
CREATE INDEX IF NOT EXISTS "Review_isApproved_createdAt_desc_idx" ON "Review"("isApproved", "createdAt" DESC);

-- 優化查詢特定用戶收到的評價
-- 已移除：Review_revieweeId_isApproved_createdAt_idx（如果使用率低，請先檢查使用情況）
-- CREATE INDEX IF NOT EXISTS "Review_revieweeId_isApproved_createdAt_idx" ON "Review"("revieweeId", "isApproved", "createdAt" DESC);

-- ========== GroupBooking 表優化 ==========

-- 優化查詢活躍的群組預約（按時間排序）
-- 注意：此索引已取代 GroupBooking_status_idx 和 GroupBooking_date_startTime_idx
CREATE INDEX IF NOT EXISTS "GroupBooking_status_date_startTime_idx" ON "GroupBooking"("status", "date", "startTime");

-- ========== MultiPlayerBooking 表優化 ==========

-- 優化查詢客戶的多人預約（按時間排序）
-- 注意：此索引已取代 MultiPlayerBooking_customerId_idx、MultiPlayerBooking_status_idx 和 MultiPlayerBooking_date_startTime_idx
CREATE INDEX IF NOT EXISTS "MultiPlayerBooking_customerId_status_createdAt_idx" ON "MultiPlayerBooking"("customerId", "status", "createdAt" DESC);

-- ========== Order 表優化 ==========

-- 優化查詢客戶的訂單（按時間排序）
CREATE INDEX IF NOT EXISTS "Order_customerId_createdAt_desc_idx" ON "Order"("customerId", "createdAt" DESC);

-- 優化查詢特定預約的訂單
-- 已移除：Order_bookingId_createdAt_idx（bookingId 通常通過 Booking 關聯查詢，不需要單獨索引）
-- CREATE INDEX IF NOT EXISTS "Order_bookingId_createdAt_idx" ON "Order"("bookingId", "createdAt" DESC);

