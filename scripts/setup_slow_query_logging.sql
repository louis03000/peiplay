-- ============================================
-- PostgreSQL 慢查詢日誌配置腳本
-- ============================================
-- 根據文章建議，設定慢查詢日誌以監控和優化 SQL 效能
-- ============================================

-- ============================================
-- 1. 啟用慢查詢日誌（需要 superuser 權限）
-- ============================================

-- 檢查當前設定
SHOW log_min_duration_statement;
SHOW log_statement;
SHOW log_line_prefix;

-- 設定慢查詢閾值為 1 秒（1000 毫秒）
-- 執行時間超過 1 秒的查詢會被記錄
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- 記錄所有 DDL 語句（CREATE, ALTER, DROP）
ALTER SYSTEM SET log_statement = 'ddl';

-- 設定日誌格式（包含時間戳、用戶、資料庫、查詢時間等）
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- 啟用查詢執行計劃日誌（對於慢查詢）
ALTER SYSTEM SET auto_explain.log_min_duration = 1000;
ALTER SYSTEM SET auto_explain.log_analyze = true;
ALTER SYSTEM SET auto_explain.log_buffers = true;
ALTER SYSTEM SET auto_explain.log_format = 'json';

-- 重新載入配置（不需要重啟 PostgreSQL）
SELECT pg_reload_conf();

-- ============================================
-- 2. 啟用 pg_stat_statements 擴展（用於查詢統計）
-- ============================================

-- 檢查是否已啟用
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- 如果未啟用，執行以下命令（需要 superuser 權限）
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- 3. 查看當前慢查詢統計（使用 pg_stat_statements）
-- ============================================

-- 查看最慢的查詢（前 20 筆）
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 查看執行次數最多的查詢
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 20;

-- 查看總執行時間最長的查詢
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ============================================
-- 4. 查看當前正在執行的慢查詢
-- ============================================

SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    state,
    wait_event_type,
    wait_event,
    query,
    application_name,
    client_addr
FROM pg_stat_activity
WHERE state <> 'idle'
  AND now() - pg_stat_activity.query_start > interval '1 second'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- ============================================
-- 5. 檢查索引使用情況（找出可能缺少索引的查詢）
-- ============================================

-- 查看順序掃描（Seq Scan）最多的表
SELECT 
    schemaname,
    relname AS table_name,
    seq_scan AS sequential_scans,
    seq_tup_read AS sequential_tuples_read,
    idx_scan AS index_scans,
    CASE 
        WHEN seq_scan + idx_scan > 0 
        THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 2)
        ELSE 0 
    END AS seq_scan_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;

-- ============================================
-- 6. 檢查未使用的索引（考慮刪除以提升寫入效能）
-- ============================================

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
  AND indexname NOT LIKE '%_key'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 注意事項：
-- ============================================
-- 1. 這些設定需要 PostgreSQL superuser 權限
-- 2. 修改後需要重新載入配置：SELECT pg_reload_conf();
-- 3. 日誌檔案位置通常在 PostgreSQL 的 log_directory 設定中
-- 4. 建議定期清理日誌檔案以避免磁碟空間不足
-- 5. 在生產環境中，建議將 log_min_duration_statement 設為 500-1000ms
-- 6. 可以使用 log_rotation_age 和 log_rotation_size 自動輪轉日誌





