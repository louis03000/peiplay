-- 修復缺失的資料庫欄位和表
-- 請在 Supabase SQL Editor 中執行此 SQL

-- 1. 添加 GroupBooking.games 欄位
ALTER TABLE "GroupBooking" ADD COLUMN IF NOT EXISTS "games" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. 確保 ChatRoom.multiPlayerBookingId 欄位存在（如果之前沒執行）
ALTER TABLE "ChatRoom" ADD COLUMN IF NOT EXISTS "multiPlayerBookingId" TEXT;

-- 3. 添加 ChatRoom 外鍵約束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ChatRoom_multiPlayerBookingId_fkey'
    ) THEN
        ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_multiPlayerBookingId_fkey" 
        FOREIGN KEY ("multiPlayerBookingId") REFERENCES "MultiPlayerBooking"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- 4. 添加 ChatRoom 唯一約束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ChatRoom_multiPlayerBookingId_key'
    ) THEN
        ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_multiPlayerBookingId_key" 
        UNIQUE ("multiPlayerBookingId");
    END IF;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- 5. 創建 RankingHistory 表（如果不存在）
CREATE TABLE IF NOT EXISTS "RankingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "partnerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RankingHistory_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. 創建 RankingHistory 索引
CREATE UNIQUE INDEX IF NOT EXISTS "RankingHistory_weekStartDate_partnerId_key" ON "RankingHistory"("weekStartDate", "partnerId");
CREATE INDEX IF NOT EXISTS "RankingHistory_weekStartDate_idx" ON "RankingHistory"("weekStartDate");
CREATE INDEX IF NOT EXISTS "RankingHistory_partnerId_idx" ON "RankingHistory"("partnerId");
CREATE INDEX IF NOT EXISTS "RankingHistory_weekStartDate_rank_idx" ON "RankingHistory"("weekStartDate", "rank");

-- 7. 確保 ChatRoom.multiPlayerBookingId 索引存在
CREATE INDEX IF NOT EXISTS "ChatRoom_multiPlayerBookingId_idx" ON "ChatRoom"("multiPlayerBookingId");

-- 8. 為 FavoritePartner 添加優化索引（用於加速 favorites API）
CREATE INDEX IF NOT EXISTS "FavoritePartner_customerId_createdAt_idx" 
ON "FavoritePartner"("customerId", "createdAt" DESC);

