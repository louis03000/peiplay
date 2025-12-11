-- 簡化版本：直接執行 SQL（如果欄位不存在）
-- 執行方式：psql $DATABASE_URL -f fix_partner_id_simple.sql

-- 檢查欄位是否存在
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Booking' AND column_name = 'partnerId'
) AS column_exists;

-- 如果上面的查詢返回 false，執行以下語句：

-- 1. 添加欄位
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;

-- 2. 更新現有記錄
UPDATE "Booking" b
SET "partnerId" = s."partnerId"
FROM "Schedule" s
WHERE b."scheduleId" = s.id AND b."partnerId" IS NULL;

-- 3. 設定為 NOT NULL
ALTER TABLE "Booking" ALTER COLUMN "partnerId" SET NOT NULL;

-- 4. 添加外鍵約束（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Booking_partnerId_fkey'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
        FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. 添加索引
CREATE INDEX IF NOT EXISTS "Booking_partnerId_idx" ON "Booking"("partnerId");
CREATE INDEX IF NOT EXISTS "Booking_partnerId_createdAt_idx" ON "Booking"("partnerId", "createdAt" DESC);

