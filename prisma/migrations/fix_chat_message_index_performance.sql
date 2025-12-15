-- ✅ 關鍵修復：優化 ChatMessage 查詢性能（從 6.5 秒降至 <100ms）
-- 問題：EXPLAIN ANALYZE 顯示 Seq Scan，索引沒有被使用
-- 原因：moderationStatus != 'REJECTED' 條件導致索引無法使用
-- 解決方案：創建部分索引（partial index）

-- 1. 刪除舊的無效索引（如果存在且沒有 DESC）
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_idx";

-- 2. 創建優化的複合索引（包含 DESC 排序）
-- 這個索引專門用於查詢特定房間的最新消息
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_desc_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- 3. 創建部分索引（partial index）用於過濾 moderationStatus
-- 這個索引只包含非 REJECTED 的消息，大幅提升查詢速度
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- 4. 驗證索引是否創建成功
-- 執行以下查詢確認：
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'ChatMessage' 
-- AND indexname LIKE 'ChatMessage_roomId%';

-- 5. 更新表統計信息（讓 PostgreSQL 知道使用新索引）
ANALYZE "ChatMessage";

-- 6. 測試查詢性能（應該使用 Index Scan，執行時間 < 100ms）
-- EXPLAIN ANALYZE
-- SELECT 
--   id,
--   "roomId",
--   "senderId",
--   "senderName",
--   "senderAvatarUrl",
--   content,
--   "createdAt"
-- FROM "ChatMessage"
-- WHERE "roomId" = 'your-room-id'
--   AND "moderationStatus" != 'REJECTED'
-- ORDER BY "createdAt" DESC, id DESC
-- LIMIT 10;
--
-- 預期結果：
-- Index Scan using ChatMessage_roomId_createdAt_not_rejected_idx
-- Execution Time: < 100ms

