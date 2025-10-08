-- 添加推薦系統相關欄位
ALTER TABLE "Partner" ADD COLUMN "referralEarnings" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "Partner" ADD COLUMN "referralCount" INTEGER DEFAULT 0;
ALTER TABLE "Partner" ADD COLUMN "totalReferralEarnings" DECIMAL(10,2) DEFAULT 0;
-- 推薦配置欄位
ALTER TABLE "Partner" ADD COLUMN "referralPlatformFee" DECIMAL(5,2) DEFAULT 10.00;
ALTER TABLE "Partner" ADD COLUMN "referralBonusPercentage" DECIMAL(5,2) DEFAULT 5.00;

-- 創建推薦記錄表
CREATE TABLE "ReferralRecord" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ReferralRecord_pkey" PRIMARY KEY ("id")
);

-- 創建推薦收入記錄表
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL,
    "referralRecordId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- 添加外鍵約束
ALTER TABLE "ReferralRecord" ADD CONSTRAINT "ReferralRecord_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralRecord" ADD CONSTRAINT "ReferralRecord_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_referralRecordId_fkey" FOREIGN KEY ("referralRecordId") REFERENCES "ReferralRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralEarning" ADD CONSTRAINT "ReferralEarning_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 創建索引
CREATE UNIQUE INDEX "ReferralRecord_inviteeId_key" ON "ReferralRecord"("inviteeId");
CREATE INDEX "ReferralRecord_inviterId_idx" ON "ReferralRecord"("inviterId");
CREATE INDEX "ReferralEarning_referralRecordId_idx" ON "ReferralEarning"("referralRecordId");
CREATE INDEX "ReferralEarning_bookingId_idx" ON "ReferralEarning"("bookingId");
