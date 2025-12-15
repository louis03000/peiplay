-- ✅ 進一步優化：添加 id 到索引以支持 ORDER BY "createdAt" DESC, id DESC
-- 問題：查詢使用 ORDER BY "createdAt" DESC, id DESC，但索引只有 (roomId, createdAt DESC)
-- 解決方案：創建包含 id 的複合索引

-- 1. 創建包含 id 的部分索引（用於 ORDER BY createdAt DESC, id DESC）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- 2. 更新統計信息
ANALYZE "ChatMessage";

-- 3. 驗證索引
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'ChatMessage' 
-- AND indexname LIKE 'ChatMessage_roomId%';

-- 4. 測試查詢（應該使用 Index Scan）
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
-- WHERE "roomId" = 'cmizih4kh0001jy04pjkx6dli'
--   AND "moderationStatus" != 'REJECTED'
-- ORDER BY "createdAt" DESC, id DESC
-- LIMIT 10;
--
-- 預期：Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx

