-- Migration: Add Password History and Password Age Tracking
-- Date: 2025-01-09
-- Purpose: Track password history and enforce password age limits

-- Step 1: Add passwordUpdatedAt to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordUpdatedAt" TIMESTAMP(3);

-- Step 2: Create PasswordHistory table
CREATE TABLE IF NOT EXISTS "PasswordHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_createdAt_idx" ON "PasswordHistory"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordHistory_userId_passwordHash_idx" ON "PasswordHistory"("userId", "passwordHash");

-- Step 4: Set initial passwordUpdatedAt for existing users
UPDATE "User" SET "passwordUpdatedAt" = "updatedAt" WHERE "passwordUpdatedAt" IS NULL;

