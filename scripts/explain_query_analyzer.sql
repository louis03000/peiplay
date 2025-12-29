-- ============================================
-- EXPLAIN 查詢分析工具
-- ============================================
-- 根據文章建議，使用 EXPLAIN 分析 SQL 查詢執行計劃
-- ============================================

-- ============================================
-- 1. EXPLAIN 基本用法
-- ============================================

-- 基本 EXPLAIN（不執行查詢）
-- EXPLAIN SELECT * FROM "Partner" WHERE status = 'APPROVED';

-- EXPLAIN ANALYZE（實際執行查詢並顯示統計）
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE) SELECT * FROM "Partner" WHERE status = 'APPROVED';

-- EXPLAIN JSON 格式（便於程式分析）
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) SELECT * FROM "Partner" WHERE status = 'APPROVED';

-- ============================================
-- 2. 分析特定查詢的執行計劃
-- ============================================

-- 範例 1: 分析夥伴列表查詢
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
    p.id,
    p.name,
    p.games,
    p."halfHourlyRate",
    p."isAvailableNow"
FROM "Partner" p
WHERE p.status = 'APPROVED'
  AND p."isAvailableNow" = true
ORDER BY p."createdAt" DESC
LIMIT 50;

-- 範例 2: 分析預約查詢（檢查是否使用索引）
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
    b.id,
    b.status,
    b."finalAmount",
    b."createdAt"
FROM "Booking" b
WHERE b."customerId" = 'YOUR_CUSTOMER_ID'
  AND b.status IN ('CONFIRMED', 'COMPLETED')
ORDER BY b."createdAt" DESC
LIMIT 50;

-- 範例 3: 分析時段查詢（檢查 JOIN 效能）
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
    s.id,
    s.date,
    s."startTime",
    s."endTime",
    p.name
FROM "Schedule" s
JOIN "Partner" p ON s."partnerId" = p.id
WHERE s.date >= CURRENT_DATE
  AND s."isAvailable" = true
ORDER BY s.date, s."startTime"
LIMIT 100;

-- ============================================
-- 3. 檢查查詢是否使用索引
-- ============================================

-- 關鍵指標說明：
-- - type: 查詢類型
--   * ALL: 全表掃描（最差，需要優化）
--   * index: 索引掃描
--   * range: 範圍掃描
--   * ref: 索引查找
--   * eq_ref: 唯一索引查找
--   * const: 常數查找（最好）
-- 
-- - key: 使用的索引名稱（NULL 表示未使用索引）
-- - rows: 估計掃描的行數（越小越好）
-- - Extra: 額外資訊
--   * Using index: 覆蓋索引（最好）
--   * Using where: 需要回表查詢
--   * Using temporary: 使用臨時表（應避免）
--   * Using filesort: 外部排序（應避免）

-- ============================================
-- 4. 找出需要優化的查詢模式
-- ============================================

-- 4.1 檢查全表掃描（type = ALL）
-- 如果 EXPLAIN 結果顯示 type = ALL，需要：
-- - 檢查 WHERE 條件是否可以使用索引
-- - 考慮添加索引
-- - 避免在 WHERE 條件中使用函數

-- 4.2 檢查大偏移量分頁（LIMIT M, N 其中 M 很大）
-- 優化方法：使用 cursor-based pagination
-- 錯誤範例：LIMIT 1000000, 10
-- 正確範例：WHERE id > last_id ORDER BY id LIMIT 10

-- 4.3 檢查模糊查詢（LIKE '%xxx'）
-- 錯誤範例：WHERE name LIKE '%翻譯%'
-- 正確範例：WHERE name LIKE '翻譯%'
-- 或者使用全文搜尋：CREATE INDEX USING gin(to_tsvector('english', name));

-- 4.4 檢查 SELECT *
-- 應該只選擇需要的欄位，以增加使用覆蓋索引的機會

-- ============================================
-- 5. 常見優化建議
-- ============================================

-- 5.1 避免全表掃描
-- ❌ 錯誤：SELECT * FROM "Partner" WHERE LOWER(name) = 'test'
-- ✅ 正確：SELECT id, name FROM "Partner" WHERE name ILIKE 'test%'

-- 5.2 使用覆蓋索引
-- 如果查詢只需要索引中的欄位，MySQL 就不需要回表
-- 範例：CREATE INDEX idx_partner_status_created ON "Partner"(status, "createdAt" DESC);

-- 5.3 優化 JOIN
-- - 確保 JOIN 條件有索引
-- - 使用 INNER JOIN 而非 LEFT JOIN（如果可能）
-- - 限制 JOIN 的結果數量

-- 5.4 優化排序
-- - 使用有索引的欄位排序
-- - 避免對多個欄位排序
-- - 考慮使用覆蓋索引包含排序欄位

-- ============================================
-- 6. 自動化 EXPLAIN 分析（使用函數）
-- ============================================

-- 建立函數來分析查詢
CREATE OR REPLACE FUNCTION explain_query(query_text TEXT)
RETURNS TABLE (
    plan JSONB
) AS $$
BEGIN
    RETURN QUERY
    EXECUTE format('EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) %s', query_text);
END;
$$ LANGUAGE plpgsql;

-- 使用範例：
-- SELECT * FROM explain_query('SELECT * FROM "Partner" WHERE status = ''APPROVED'' LIMIT 10');

-- ============================================
-- 7. 檢查查詢效能指標
-- ============================================

-- 執行以下查詢並檢查：
-- 1. Planning Time: 查詢計劃時間（應該 < 10ms）
-- 2. Execution Time: 執行時間（應該 < 100ms 對於簡單查詢）
-- 3. Buffers: 緩衝區使用情況
--    - shared hit: 從緩衝區讀取（快）
--    - shared read: 從磁碟讀取（慢）
-- 4. Rows: 實際掃描的行數

-- ============================================
-- 8. 定期檢查建議
-- ============================================

-- 建議每天或每週執行以下檢查：
-- 1. 查看慢查詢日誌
-- 2. 分析最慢的查詢（使用 EXPLAIN ANALYZE）
-- 3. 檢查是否有全表掃描
-- 4. 檢查索引使用情況
-- 5. 優化發現的問題












