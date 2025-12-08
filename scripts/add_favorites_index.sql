-- 為 FavoritePartner 表添加優化索引
-- 用於加速 favorites API 查詢

-- 優化查詢：customerId + createdAt DESC
-- 這是主要的查詢模式，用於快速獲取用戶的最愛列表並按時間排序
-- 注意：customerId 索引已存在，但添加複合索引可以進一步優化排序
-- 使用 DESC 排序以匹配查詢的 ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "FavoritePartner_customerId_createdAt_idx" 
ON "FavoritePartner"("customerId", "createdAt" DESC);

-- 如果上面的 DESC 索引創建失敗（某些資料庫版本不支持），使用普通索引
-- CREATE INDEX IF NOT EXISTS "FavoritePartner_customerId_createdAt_idx" 
-- ON "FavoritePartner"("customerId", "createdAt");

-- 驗證索引是否創建成功
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'FavoritePartner'
ORDER BY indexname;

