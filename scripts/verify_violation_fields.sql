-- 驗證 violationCount 和 violations 欄位是否成功添加
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'Customer'
AND column_name IN ('violationCount', 'violations')
ORDER BY column_name;


