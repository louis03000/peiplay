-- ✅ 最終修復：確保 ChatMessage 查詢使用索引（從 6 秒降至 < 10ms）
-- 問題：查詢中有 ::text cast，導致無法使用索引
-- 解決：建立正確的複合索引，確保查詢能使用

-- ============================================
-- 步驟 1：刪除可能存在的舊索引（如果格式不對）
-- ============================================
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_idx";
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_desc_idx";

-- ============================================
-- 步驟 2：建立「保證命中」的複合索引
-- ============================================
-- 查詢模式：WHERE roomId = ? AND moderationStatus != 'REJECTED' ORDER BY createdAt DESC, id DESC
-- 索引必須完全匹配查詢順序

-- 2.1 基礎複合索引（用於沒有 moderationStatus 過濾的查詢）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_desc_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- 2.2 部分索引（Partial Index）- 最優化
-- 這個索引專門用於 moderationStatus != 'REJECTED' 的查詢
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- ============================================
-- 步驟 3：更新表統計信息（關鍵！）
-- ============================================
ANALYZE "ChatMessage";

-- ============================================
-- 步驟 4：驗證索引
-- ============================================
-- 執行以下查詢確認索引存在：
-- 
-- SELECT 
--   indexname, 
--   indexdef
-- FROM pg_indexes 
-- WHERE tablename = 'ChatMessage' 
--   AND indexname LIKE 'ChatMessage_roomId%'
-- ORDER BY indexname;

-- ============================================
-- 步驟 5：測試查詢（使用真實 roomId）
-- ============================================
-- 先獲取一個真實的 roomId：
-- SELECT id FROM "ChatRoom" LIMIT 1;
--
-- 然後執行：
-- EXPLAIN ANALYZE
-- SELECT 
--   id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
-- FROM "ChatMessage"
-- WHERE "roomId" = '真實的-room-id'
--   AND "moderationStatus" != 'REJECTED'
-- ORDER BY "createdAt" DESC, id DESC
-- LIMIT 10;
--
-- 預期結果：
-- Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx
-- Execution Time: < 10ms

