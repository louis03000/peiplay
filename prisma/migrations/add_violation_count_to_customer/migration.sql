-- Migration: Add violationCount and violations columns to Customer table
-- 添加違規計數和違規詳情欄位到 Customer 表

-- 添加 violationCount 欄位（如果不存在）
ALTER TABLE "Customer" 
ADD COLUMN IF NOT EXISTS "violationCount" INTEGER NOT NULL DEFAULT 0;

-- 添加 violations 欄位（如果不存在）
ALTER TABLE "Customer" 
ADD COLUMN IF NOT EXISTS "violations" JSONB;

-- 驗證欄位是否成功添加
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'Customer'
AND column_name IN ('violationCount', 'violations');

