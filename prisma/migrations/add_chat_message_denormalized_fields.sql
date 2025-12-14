-- Migration: Add denormalized fields to ChatMessage
-- ⚠️ 必須在 maintenance window 執行
-- 執行前請先備份資料庫：pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql

-- Step 1: 添加 denormalized 字段
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立複合索引（CONCURRENTLY 不鎖表）
-- 注意：CONCURRENTLY 只能在 transaction 外執行
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- Step 3: 驗證索引（可選，用於檢查）
-- EXPLAIN ANALYZE
-- SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
-- FROM "ChatMessage"
-- WHERE "roomId" = 'test-room-id'
-- ORDER BY "createdAt" DESC
-- LIMIT 30;

-- 預期結果：
-- Index Scan using ChatMessage_roomId_createdAt_idx
-- Execution Time: < 100ms
