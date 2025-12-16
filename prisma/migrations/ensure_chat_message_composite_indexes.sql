-- ✅ 確保 ChatMessage 表的 composite index 存在（關鍵效能優化）
-- 這個 migration 確保所有必要的索引都存在，用於高效查詢訊息
-- 
-- 執行此 migration 可大幅提升 messages API 查詢速度（從秒級降至毫秒級）
-- 
-- 查詢模式：
-- 1. WHERE roomId = ? AND moderationStatus != 'REJECTED' ORDER BY createdAt DESC, id DESC LIMIT 10
-- 2. WHERE roomId = ? AND createdAt > ? ORDER BY createdAt ASC LIMIT 10

-- ============================================
-- 1. 基礎複合索引：roomId + createdAt DESC
-- ============================================
-- 用於查詢特定房間的最新訊息（不考慮 moderationStatus）
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_desc_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- ============================================
-- 2. 部分索引（Partial Index）：過濾 REJECTED 訊息
-- ============================================
-- 這是關鍵優化：只索引非 REJECTED 的訊息，大幅提升查詢速度
-- 用於查詢：WHERE roomId = ? AND moderationStatus != 'REJECTED' ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- ============================================
-- 3. 包含 id 的部分索引：支援 ORDER BY createdAt DESC, id DESC
-- ============================================
-- 用於查詢：WHERE roomId = ? AND moderationStatus != 'REJECTED' 
--          ORDER BY createdAt DESC, id DESC LIMIT 10
-- 這個索引完全覆蓋查詢需求，避免額外的排序操作
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- ============================================
-- 4. 更新表統計信息
-- ============================================
-- 讓 PostgreSQL 查詢規劃器知道使用新索引
ANALYZE "ChatMessage";

-- ============================================
-- 驗證索引是否創建成功
-- ============================================
-- 執行以下查詢確認：
-- 
-- SELECT 
--   indexname, 
--   indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'ChatMessage' 
--   AND indexname LIKE 'ChatMessage_roomId%'
-- ORDER BY indexname;

-- ============================================
-- 測試查詢性能
-- ============================================
-- 執行以下查詢測試性能（應該使用 Index Scan，執行時間 < 100ms）：
-- 
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
-- Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx
-- Execution Time: < 100ms

