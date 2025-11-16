-- 添加效能優化索引
-- 這些索引將大幅提升查詢速度

-- Partner 表索引
CREATE INDEX IF NOT EXISTS "Partner_status_idx" ON "Partner"("status");
CREATE INDEX IF NOT EXISTS "Partner_status_isAvailableNow_idx" ON "Partner"("status", "isAvailableNow");
CREATE INDEX IF NOT EXISTS "Partner_status_isRankBooster_idx" ON "Partner"("status", "isRankBooster");
CREATE INDEX IF NOT EXISTS "Partner_userId_idx" ON "Partner"("userId");

-- Schedule 表索引
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_date_isAvailable_idx" ON "Schedule"("partnerId", "date", "isAvailable");
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_date_idx" ON "Schedule"("partnerId", "date");
CREATE INDEX IF NOT EXISTS "Schedule_date_isAvailable_idx" ON "Schedule"("date", "isAvailable");
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_isAvailable_idx" ON "Schedule"("partnerId", "isAvailable");

-- Booking 表索引
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");
CREATE INDEX IF NOT EXISTS "Booking_customerId_status_idx" ON "Booking"("customerId", "status");
CREATE INDEX IF NOT EXISTS "Booking_scheduleId_idx" ON "Booking"("scheduleId");
CREATE INDEX IF NOT EXISTS "Booking_customerId_createdAt_idx" ON "Booking"("customerId", "createdAt");

-- Customer 表索引
CREATE INDEX IF NOT EXISTS "Customer_userId_idx" ON "Customer"("userId");

-- WithdrawalRequest 表索引
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_partnerId_idx" ON "WithdrawalRequest"("partnerId");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_partnerId_status_idx" ON "WithdrawalRequest"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_partnerId_requestedAt_idx" ON "WithdrawalRequest"("partnerId", "requestedAt");

