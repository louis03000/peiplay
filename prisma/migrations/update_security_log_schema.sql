-- Migration: Update SecurityLog to support nullable userId and new event types
-- Date: 2025-01-09
-- Purpose: Support system-level security events that may not have a userId

-- Step 1: Add new event types to SecurityEventType enum
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'RATE_LIMIT_EXCEEDED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'CSRF_TOKEN_INVALID';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'MFA_VERIFICATION_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_BREACHED_CHECK';

-- Step 2: Make userId nullable in SecurityLog
-- First, update existing records that might have 'system' as userId
UPDATE "SecurityLog" SET "userId" = NULL WHERE "userId" = 'system' OR "userId" = 'anonymous';

-- Step 3: Drop the foreign key constraint temporarily
ALTER TABLE "SecurityLog" DROP CONSTRAINT IF EXISTS "SecurityLog_userId_fkey";

-- Step 4: Alter the column to allow NULL
ALTER TABLE "SecurityLog" ALTER COLUMN "userId" DROP NOT NULL;

-- Step 5: Re-add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE "SecurityLog" 
  ADD CONSTRAINT "SecurityLog_userId_fkey" 
  FOREIGN KEY ("userId") 
  REFERENCES "User"("id") 
  ON DELETE SET NULL;

-- Note: Indexes remain the same as they already support NULL values

