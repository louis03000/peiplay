-- ✅ 立即修復：確保 ChatMessage 使用索引而非 Seq Scan
-- 問題：查詢計劃顯示 Seq Scan，沒有使用索引
-- 解決：創建並驗證索引，更新統計信息

-- ============================================
-- 步驟 1：刪除可能存在的舊索引（如果格式不對）
-- ============================================
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_idx";

-- ============================================
-- 步驟 2：創建最優化的部分索引（Partial Index）
-- ============================================
-- 這個索引專門用於查詢：WHERE roomId = ? AND moderationStatus != 'REJECTED' ORDER BY createdAt DESC, id DESC
-- 使用 CONCURRENTLY 避免鎖表（如果表很大）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- ============================================
-- 步驟 3：如果 CONCURRENTLY 失敗（在 transaction 中），使用普通方式
-- ============================================
-- 注意：如果上面的 CONCURRENTLY 失敗，執行這個（會鎖表，但通常很快）
-- CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
-- ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
-- WHERE "moderationStatus" != 'REJECTED';

-- ============================================
-- 步驟 4：更新表統計信息（關鍵！）
-- ============================================
-- 這讓 PostgreSQL 查詢規劃器知道使用新索引
ANALYZE "ChatMessage";

-- ============================================
-- 步驟 5：驗證索引已創建
-- ============================================
-- 執行以下查詢確認索引存在：
-- SELECT 
--   indexname, 
--   indexdef,
--   indisvalid
-- FROM pg_indexes 
-- LEFT JOIN pg_index ON pg_indexes.indexname = pg_class.relname
-- WHERE tablename = 'ChatMessage' 
--   AND indexname LIKE 'ChatMessage_roomId%'
-- ORDER BY indexname;

-- ============================================
-- 步驟 6：強制使用索引（測試用）
-- ============================================
-- 如果索引存在但沒有被使用，可以強制使用：
-- SET enable_seqscan = off;
-- EXPLAIN ANALYZE
-- SELECT id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
-- FROM "ChatMessage"
-- WHERE "roomId" = 'your-room-id'
--   AND "moderationStatus" != 'REJECTED'
-- ORDER BY "createdAt" DESC, id DESC
-- LIMIT 10;
-- SET enable_seqscan = on;

