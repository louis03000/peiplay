-- 為 FavoritePartner 表添加優化索引
-- 用於加速 favorites API 查詢

-- 優化查詢：customerId + createdAt DESC
-- 這是主要的查詢模式，用於快速獲取用戶的最愛列表並按時間排序
-- 注意：customerId 索引已存在，但添加複合索引可以進一步優化排序
CREATE INDEX IF NOT EXISTS "FavoritePartner_customerId_createdAt_idx" 
ON "FavoritePartner"("customerId", "createdAt" DESC);

-- 優化查詢：快速檢查用戶是否有最愛
-- 如果只需要檢查是否存在，可以使用 count 查詢
-- customerId 索引已足夠，但複合索引可以加速排序查詢

-- 驗證索引是否創建成功
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'FavoritePartner'
ORDER BY indexname;

