-- ============================================
-- Manual Migration: Add KYC, Payment, Refund, Support Models
-- ============================================
-- 執行日期：請在執行前記錄
-- 執行方式：psql $DATABASE_URL -f prisma/migrations/manual_add_kyc_payment_refund_models.sql
-- ============================================

-- ============================================
-- 1. 新增 Enum 類型
-- ============================================

CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PARTNER_RESPONDED', 'ADMIN_REVIEWING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- ============================================
-- 2. 新增 Booking.partnerId 欄位（如果不存在）
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Booking' AND column_name = 'partnerId'
    ) THEN
        ALTER TABLE "Booking" ADD COLUMN "partnerId" TEXT;
        
        -- 從 Schedule 關聯更新 partnerId
        UPDATE "Booking" b
        SET "partnerId" = s."partnerId"
        FROM "Schedule" s
        WHERE b."scheduleId" = s.id AND b."partnerId" IS NULL;
        
        -- 設定為 NOT NULL（在資料更新後）
        ALTER TABLE "Booking" ALTER COLUMN "partnerId" SET NOT NULL;
        
        -- 添加外鍵約束
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
        FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================
-- 3. 建立 KYC 表
-- ============================================

CREATE TABLE IF NOT EXISTS "KYC" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "idNumberHash" TEXT,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "selfieUrl" TEXT,
    "videoUrl" TEXT,
    "status" "KYCStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KYC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KYC_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KYC_status_idx" ON "KYC"("status");
CREATE INDEX IF NOT EXISTS "KYC_userId_idx" ON "KYC"("userId");
CREATE INDEX IF NOT EXISTS "KYC_status_createdAt_idx" ON "KYC"("status", "createdAt");

-- ============================================
-- 4. 建立 PartnerVerification 表
-- ============================================

CREATE TABLE IF NOT EXISTS "PartnerVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL UNIQUE,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "selfieUrl" TEXT,
    "videoUrl" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerVerification_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerVerification_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PartnerVerification_status_idx" ON "PartnerVerification"("status");
CREATE INDEX IF NOT EXISTS "PartnerVerification_partnerId_idx" ON "PartnerVerification"("partnerId");
CREATE INDEX IF NOT EXISTS "PartnerVerification_status_createdAt_idx" ON "PartnerVerification"("status", "createdAt");

-- ============================================
-- 5. 建立 Payment 表
-- ============================================

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "status" "PaymentStatus" NOT NULL,
    "rawResponse" JSONB,
    "idempotencyKey" TEXT UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Payment_providerId_idx" ON "Payment"("providerId");
CREATE INDEX IF NOT EXISTS "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");

-- ============================================
-- 6. 建立 RefundRequest 表
-- ============================================

CREATE TABLE IF NOT EXISTS "RefundRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "amountCents" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "partnerResponse" TEXT,
    "partnerResponseAt" TIMESTAMP(3),
    "adminDecision" TEXT,
    "adminDecisionAt" TIMESTAMP(3),
    "adminId" TEXT,
    "idempotencyKey" TEXT UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RefundRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RefundRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RefundRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RefundRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RefundRequest_bookingId_idx" ON "RefundRequest"("bookingId");
CREATE INDEX IF NOT EXISTS "RefundRequest_userId_idx" ON "RefundRequest"("userId");
CREATE INDEX IF NOT EXISTS "RefundRequest_partnerId_idx" ON "RefundRequest"("partnerId");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_idx" ON "RefundRequest"("status");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RefundRequest_idempotencyKey_idx" ON "RefundRequest"("idempotencyKey");

-- ============================================
-- 7. 建立 SupportTicket 表
-- ============================================

CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT,
    "bookingId" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx" ON "SupportTicket"("userId");
CREATE INDEX IF NOT EXISTS "SupportTicket_partnerId_idx" ON "SupportTicket"("partnerId");
CREATE INDEX IF NOT EXISTS "SupportTicket_bookingId_idx" ON "SupportTicket"("bookingId");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- ============================================
-- 8. 建立 SupportMessage 表
-- ============================================

CREATE TABLE IF NOT EXISTS "SupportMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");
CREATE INDEX IF NOT EXISTS "SupportMessage_senderId_idx" ON "SupportMessage"("senderId");
CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- ============================================
-- 9. 建立 LogEntry 表
-- ============================================

CREATE TABLE IF NOT EXISTS "LogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LogEntry_actorId_idx" ON "LogEntry"("actorId");
CREATE INDEX IF NOT EXISTS "LogEntry_action_idx" ON "LogEntry"("action");
CREATE INDEX IF NOT EXISTS "LogEntry_resourceType_resourceId_idx" ON "LogEntry"("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "LogEntry_createdAt_idx" ON "LogEntry"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LogEntry_action_createdAt_idx" ON "LogEntry"("action", "createdAt" DESC);

-- ============================================
-- 10. 添加 Booking.partnerId 索引（如果尚未存在）
-- ============================================

CREATE INDEX IF NOT EXISTS "Booking_partnerId_idx" ON "Booking"("partnerId");
CREATE INDEX IF NOT EXISTS "Booking_partnerId_createdAt_idx" ON "Booking"("partnerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Booking_partnerId_status_idx" ON "Booking"("partnerId", "status", "createdAt" DESC);

-- ============================================
-- Migration 完成
-- ============================================
-- 請執行以下命令驗證：
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('KYC', 'PartnerVerification', 'Payment', 'RefundRequest', 'SupportTicket', 'SupportMessage', 'LogEntry');
-- ============================================

