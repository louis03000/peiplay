-- ✅ 關鍵索引：ChatMessage 表性能優化
-- 執行此 migration 可大幅提升 messages API 查詢速度（從 8 秒降至 <200ms）

-- 1. 複合索引：roomId + createdAt DESC（用於最新消息查詢）
-- 這是 messages API 最常用的查詢模式
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- 2. 索引：moderationStatus（用於過濾被拒絕的消息）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_moderationStatus_idx"
ON "ChatMessage"("moderationStatus")
WHERE "moderationStatus" != 'REJECTED';

-- 3. 複合索引：roomId + moderationStatus（用於組合查詢）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_moderationStatus_idx"
ON "ChatMessage"("roomId", "moderationStatus")
WHERE "moderationStatus" != 'REJECTED';

-- ✅ 驗證索引是否建立成功
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'ChatMessage' 
-- AND indexname LIKE 'ChatMessage_%';

-- ✅ 測試查詢性能（應該 < 200ms）
-- EXPLAIN ANALYZE
-- SELECT id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
-- FROM "ChatMessage"
-- WHERE "roomId" = 'your-room-id'
--   AND "moderationStatus" != 'REJECTED'
-- ORDER BY "createdAt" DESC, id DESC
-- LIMIT 10;

