-- Migration: Add Multi-Player Booking System
-- 執行日期: 請在 Supabase SQL Editor 中執行此 SQL

-- 1. 創建 MultiPlayerBookingStatus enum
DO $$ BEGIN
    CREATE TYPE "MultiPlayerBookingStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 在 Customer 表新增違規相關欄位
ALTER TABLE "Customer" 
ADD COLUMN IF NOT EXISTS "violationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "violations" JSONB;

-- 3. 創建 MultiPlayerBooking 表
CREATE TABLE IF NOT EXISTS "MultiPlayerBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "games" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MultiPlayerBookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAdjustmentAt" TIMESTAMP(3),
    CONSTRAINT "MultiPlayerBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. 在 Booking 表新增多人陪玩相關欄位
ALTER TABLE "Booking" 
ADD COLUMN IF NOT EXISTS "multiPlayerBookingId" TEXT,
ADD COLUMN IF NOT EXISTS "isMultiPlayerBooking" BOOLEAN NOT NULL DEFAULT false;

-- 5. 添加外鍵約束
DO $$ BEGIN
    ALTER TABLE "Booking" 
    ADD CONSTRAINT "Booking_multiPlayerBookingId_fkey" 
    FOREIGN KEY ("multiPlayerBookingId") REFERENCES "MultiPlayerBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. 在 ChatRoom 表新增多人陪玩關聯
ALTER TABLE "ChatRoom" 
ADD COLUMN IF NOT EXISTS "multiPlayerBookingId" TEXT;

-- 7. 添加外鍵約束和唯一約束
DO $$ BEGIN
    ALTER TABLE "ChatRoom" 
    ADD CONSTRAINT "ChatRoom_multiPlayerBookingId_fkey" 
    FOREIGN KEY ("multiPlayerBookingId") REFERENCES "MultiPlayerBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChatRoom" 
    ADD CONSTRAINT "ChatRoom_multiPlayerBookingId_key" UNIQUE ("multiPlayerBookingId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 8. 創建索引
CREATE INDEX IF NOT EXISTS "MultiPlayerBooking_customerId_idx" ON "MultiPlayerBooking"("customerId");
CREATE INDEX IF NOT EXISTS "MultiPlayerBooking_status_idx" ON "MultiPlayerBooking"("status");
CREATE INDEX IF NOT EXISTS "MultiPlayerBooking_date_startTime_idx" ON "MultiPlayerBooking"("date", "startTime");
CREATE INDEX IF NOT EXISTS "Booking_multiPlayerBookingId_idx" ON "Booking"("multiPlayerBookingId");
CREATE INDEX IF NOT EXISTS "ChatRoom_multiPlayerBookingId_idx" ON "ChatRoom"("multiPlayerBookingId");

-- 9. 驗證創建結果
SELECT 
    'MultiPlayerBooking table created' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'MultiPlayerBooking';

SELECT 
    'MultiPlayerBookingStatus enum created' as status,
    COUNT(*) as enum_count
FROM pg_type 
WHERE typname = 'MultiPlayerBookingStatus';

