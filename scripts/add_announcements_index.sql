-- 為 Announcement 表添加優化索引
-- 用於加速 announcements API 查詢

-- 優化查詢：isActive + createdAt DESC
-- 這是主要的查詢模式，用於快速獲取活躍公告並按時間排序
-- 注意：isActive + expiresAt 索引已存在，但添加 createdAt 索引可以進一步優化排序
CREATE INDEX IF NOT EXISTS "Announcement_isActive_createdAt_idx" 
ON "Announcement"("isActive", "createdAt" DESC);

-- 優化查詢：isActive + expiresAt + createdAt
-- 用於過濾未過期的公告並按時間排序
-- 注意：由於 expiresAt 可能為 NULL，使用 NULLS FIRST
CREATE INDEX IF NOT EXISTS "Announcement_isActive_expiresAt_createdAt_idx" 
ON "Announcement"("isActive", "expiresAt" NULLS FIRST, "createdAt" DESC);

-- 部分索引：只索引活躍且未過期的公告（更高效，但需要定期維護）
-- 如果大部分公告都會過期，這個索引會更小更快
-- CREATE INDEX IF NOT EXISTS "Announcement_active_not_expired_createdAt_idx" 
-- ON "Announcement"("createdAt" DESC)
-- WHERE "isActive" = true AND ("expiresAt" IS NULL OR "expiresAt" > NOW());

-- 驗證索引是否創建成功
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Announcement'
ORDER BY indexname;

