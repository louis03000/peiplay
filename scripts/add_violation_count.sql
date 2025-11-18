-- 快速修復：添加 violationCount 和 violations 欄位到 Customer 表
-- 請在 Supabase SQL Editor 中執行此 SQL

-- 添加 violationCount 欄位（如果不存在）
ALTER TABLE "Customer" 
ADD COLUMN IF NOT EXISTS "violationCount" INTEGER NOT NULL DEFAULT 0;

-- 添加 violations 欄位（如果不存在）
ALTER TABLE "Customer" 
ADD COLUMN IF NOT EXISTS "violations" JSONB;

-- 驗證欄位是否成功添加
SELECT 
    'violationCount column added' as status,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'Customer'
AND column_name IN ('violationCount', 'violations');

