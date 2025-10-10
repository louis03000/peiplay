-- 添加 Discord 預約流程相關欄位
ALTER TABLE "Booking" ADD COLUMN "discordEarlyTextChannelId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "extensionButtonShown" BOOLEAN DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "ratingCompleted" BOOLEAN DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "textChannelCleaned" BOOLEAN DEFAULT false;

-- 添加索引以提升查詢性能
CREATE INDEX "Booking_discordEarlyTextChannelId_idx" ON "Booking"("discordEarlyTextChannelId");
CREATE INDEX "Booking_extensionButtonShown_idx" ON "Booking"("extensionButtonShown");
CREATE INDEX "Booking_ratingCompleted_idx" ON "Booking"("ratingCompleted");
CREATE INDEX "Booking_textChannelCleaned_idx" ON "Booking"("textChannelCleaned");
