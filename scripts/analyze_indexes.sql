-- 索引分析腳本
-- 用於分析 Peiplay 資料庫中所有索引的使用情況和必要性

-- ========== 1. 查看所有表的索引 ==========
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ========== 2. 檢查索引使用統計 ==========
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "使用次數",
    idx_tup_read as "讀取行數",
    idx_tup_fetch as "取得行數",
    pg_size_pretty(pg_relation_size(indexrelid)) as "索引大小"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, tablename, indexname;

-- ========== 3. 檢查從未被使用的索引（idx_scan = 0）==========
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as "索引大小",
    indexdef
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexname NOT LIKE '%_pkey'  -- 排除主鍵
    AND indexname NOT LIKE '%_key'   -- 排除唯一約束
ORDER BY pg_relation_size(indexrelid) DESC;

-- ========== 4. 檢查重複的索引（相同欄位組合）==========
SELECT 
    tablename,
    array_to_string(array_agg(indexname ORDER BY indexname), ', ') as "重複索引",
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename, indexdef
HAVING COUNT(*) > 1
ORDER BY tablename;

-- ========== 5. 檢查可以合併的索引（一個索引是另一個的前綴）==========
-- 例如：index1(a, b) 和 index2(a) 可以合併，因為 index1 可以覆蓋 index2 的用途
SELECT 
    i1.tablename,
    i1.indexname as "較短索引",
    i2.indexname as "較長索引",
    i1.indexdef as "較短索引定義",
    i2.indexdef as "較長索引定義"
FROM pg_indexes i1
JOIN pg_indexes i2 ON i1.tablename = i2.tablename
WHERE i1.schemaname = 'public'
    AND i2.schemaname = 'public'
    AND i1.indexname < i2.indexname
    AND i1.indexdef LIKE '%' || SUBSTRING(i2.indexdef FROM '\(([^)]+)\)') || '%'
ORDER BY i1.tablename, i1.indexname;

-- ========== 6. 檢查每個表的索引總數和總大小 ==========
SELECT 
    tablename,
    COUNT(*) as "索引數量",
    pg_size_pretty(SUM(pg_relation_size(indexname::regclass))) as "總索引大小"
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY SUM(pg_relation_size(indexname::regclass)) DESC;

