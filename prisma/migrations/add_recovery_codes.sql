-- Migration: Add Recovery Codes to User table
-- Date: 2025-01-09
-- Purpose: Store hashed recovery codes for MFA

-- Add recoveryCodes column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recoveryCodes" TEXT;

-- Note: recoveryCodes is stored as JSON array of hashed codes
-- Example: ["$2a$10$...", "$2a$10$...", ...]

