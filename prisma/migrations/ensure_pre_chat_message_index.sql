-- ✅ 確保 PreChatMessage 表的 composite index 存在
-- 這個 migration 確保預聊系統的訊息查詢使用正確的索引

-- ============================================
-- 複合索引：room_id + created_at DESC
-- ============================================
-- 用於查詢特定預聊房間的最新訊息
-- 查詢模式：WHERE room_id = ? ORDER BY created_at DESC LIMIT 10
CREATE INDEX IF NOT EXISTS "idx_pre_chat_messages_room_time"
ON "pre_chat_messages"("room_id", "created_at" DESC);

-- ============================================
-- 驗證索引是否創建成功
-- ============================================
-- SELECT 
--   indexname, 
--   indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'pre_chat_messages' 
--   AND indexname = 'idx_pre_chat_messages_room_time';

-- ============================================
-- 測試查詢性能
-- ============================================
-- EXPLAIN ANALYZE
-- SELECT 
--   id,
--   room_id,
--   sender_type,
--   content,
--   created_at
-- FROM pre_chat_messages
-- WHERE room_id = 'your-room-id'
-- ORDER BY created_at DESC
-- LIMIT 10;
--
-- 預期結果：
-- Index Scan using idx_pre_chat_messages_room_time
-- Execution Time: < 50ms

