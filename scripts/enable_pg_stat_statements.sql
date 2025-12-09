-- ============================================
-- 啟用 pg_stat_statements 擴展
-- ============================================
-- 此腳本用於啟用 PostgreSQL 的查詢統計功能
-- 執行後可以追蹤慢查詢
-- ============================================

-- 1. 啟用擴展（需要 superuser 權限）
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 2. 設定 pg_stat_statements 參數（需要在 postgresql.conf 中設定，或使用 ALTER SYSTEM）
-- 以下設定建議值（需要重啟 PostgreSQL 才能生效）：
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all
-- pg_stat_statements.track_utility = on

-- 3. 查看當前設定
SELECT name, setting, unit, short_desc 
FROM pg_settings 
WHERE name LIKE 'pg_stat_statements%';

-- ============================================
-- 常用查詢統計查詢
-- ============================================

-- 查看 top 50 慢查詢
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    min_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 50;

-- 查看最常執行的查詢
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 50;

-- 查看總執行時間最長的查詢
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 50;

-- 重置統計資料（謹慎使用）
-- SELECT pg_stat_statements_reset();

