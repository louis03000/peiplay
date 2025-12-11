-- 添加 partnerId 欄位到 Booking 表（如果不存在）
DO $$ 
BEGIN
    -- 檢查欄位是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Booking' AND column_name = 'partnerId'
    ) THEN
        -- 添加欄位（先設為可空）
        ALTER TABLE "Booking" ADD COLUMN "partnerId" TEXT;
        
        -- 從 Schedule 關聯更新現有記錄的 partnerId
        UPDATE "Booking" b
        SET "partnerId" = s."partnerId"
        FROM "Schedule" s
        WHERE b."scheduleId" = s.id AND b."partnerId" IS NULL;
        
        -- 設定為 NOT NULL（在資料更新後）
        ALTER TABLE "Booking" ALTER COLUMN "partnerId" SET NOT NULL;
        
        -- 添加外鍵約束
        DO $$ 
        BEGIN
            ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
            FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        
        -- 添加索引
        CREATE INDEX IF NOT EXISTS "Booking_partnerId_idx" ON "Booking"("partnerId");
        CREATE INDEX IF NOT EXISTS "Booking_partnerId_createdAt_idx" ON "Booking"("partnerId", "createdAt" DESC);
    END IF;
END $$;

