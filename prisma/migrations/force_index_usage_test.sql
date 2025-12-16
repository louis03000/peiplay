-- ✅ 強制使用索引測試（確認索引是否正確）
-- 當表很小時，PostgreSQL 可能選擇 Seq Scan（因為更快）
-- 這個測試可以強制使用索引

-- ============================================
-- 步驟 1：檢查表大小
-- ============================================
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE "moderationStatus" != 'REJECTED') as non_rejected_rows
FROM "ChatMessage";

-- ============================================
-- 步驟 2：強制使用索引（測試用）
-- ============================================
-- 暫時禁用 Seq Scan，強制使用索引
SET enable_seqscan = off;

-- 使用真實的 roomId 測試（替換 'your-room-id'）
EXPLAIN ANALYZE
SELECT 
  id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'  -- 替換為真實的 roomId
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;

-- 恢復設定
SET enable_seqscan = on;

-- ============================================
-- 步驟 3：如果強制使用索引後還是慢
-- ============================================
-- 可能的原因：
-- 1. roomId 型別不一致（檢查 Prisma schema）
-- 2. 查詢條件不匹配索引
-- 3. 統計信息過時（執行 ANALYZE "ChatMessage";）

-- ============================================
-- 步驟 4：檢查索引是否真的存在且有效
-- ============================================
SELECT 
  i.indexname,
  i.indexdef,
  pg_size_pretty(pg_relation_size(i.indexname::regclass)) as index_size,
  idx.indisvalid as is_valid,
  idx.indisready as is_ready
FROM pg_indexes i
LEFT JOIN pg_index idx ON i.indexname = pg_class.relname
WHERE i.tablename = 'ChatMessage' 
  AND i.indexname LIKE 'ChatMessage_roomId%'
ORDER BY i.indexname;

