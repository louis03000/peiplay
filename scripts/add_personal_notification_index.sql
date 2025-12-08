-- 為 PersonalNotification 表添加優化索引
-- 用於加速 personal-notifications API 查詢

-- 優化查詢：userId + createdAt DESC
-- 這是主要的查詢模式，用於快速獲取用戶的最新通知
-- 注意：此索引已存在於 add_additional_performance_indexes.sql 中
-- CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isRead_createdAt_idx" 
-- ON "PersonalNotification"("userId", "isRead", "createdAt" DESC);

-- 優化查詢：userId + isImportant + priority + createdAt
-- 用於查詢重要通知並按優先級排序（如果需要在資料庫層排序）
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_isImportant_priority_createdAt_idx" 
ON "PersonalNotification"("userId", "isImportant", "priority" DESC, "createdAt" DESC);

-- 優化查詢：userId + expiresAt + createdAt
-- 用於過濾未過期的通知（如果需要在資料庫層過濾）
-- 注意：由於 expiresAt 可能為 NULL，使用 NULLS FIRST
CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_expiresAt_createdAt_idx" 
ON "PersonalNotification"("userId", "expiresAt" NULLS FIRST, "createdAt" DESC);

-- 部分索引：只索引未過期的通知（更高效，但需要定期維護）
-- 如果大部分通知都會過期，這個索引會更小更快
-- CREATE INDEX IF NOT EXISTS "PersonalNotification_userId_active_createdAt_idx" 
-- ON "PersonalNotification"("userId", "createdAt" DESC)
-- WHERE "expiresAt" IS NULL OR "expiresAt" > NOW();

