-- Migration: Add denormalized fields to ChatMessage
-- ⚠️ 必須在 maintenance window 執行
-- 執行前請先備份資料庫：pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql

-- Step 1: 添加 denormalized 字段
-- ⚠️ 注意：這兩個命令可以一起執行（在同一個 ALTER TABLE 中）
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立複合索引（CONCURRENTLY 不鎖表）
-- ⚠️ 重要：CONCURRENTLY 必須在 transaction 外執行（不能有 BEGIN/COMMIT）
-- ⚠️ 重要：如果使用 psql，確保不在 transaction 模式
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- Step 3: 驗證（執行後檢查）
-- 檢查字段：
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'ChatMessage' AND column_name IN ('senderName', 'senderAvatarUrl');
--
-- 檢查索引：
-- SELECT indexname, indexdef FROM pg_indexes 
-- WHERE tablename = 'ChatMessage' AND indexname = 'ChatMessage_roomId_createdAt_idx';
--
-- 測試性能：
-- EXPLAIN ANALYZE
-- SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
-- FROM "ChatMessage"
-- WHERE "roomId" = 'test-room-id'
-- ORDER BY "createdAt" DESC
-- LIMIT 30;
--
-- 預期結果：
-- Index Scan using ChatMessage_roomId_createdAt_idx
-- Execution Time: < 100ms
