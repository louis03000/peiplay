-- 更新推薦系統默認值
-- 將 referralPlatformFee 從 10.00 改為 15.00（沒有推薦時使用標準15%）
-- 將 referralBonusPercentage 從 5.00 改為 0.00（沒有推薦時為0%）

-- 更新現有夥伴的默認值（只更新那些沒有推薦記錄的夥伴）
UPDATE "Partner"
SET 
  "referralPlatformFee" = 15.00,
  "referralBonusPercentage" = 0.00
WHERE 
  "referralCount" = 0
  AND ("referralPlatformFee" = 10.00 OR "referralPlatformFee" IS NULL);

-- 更新 schema 的默認值（這需要在 Prisma schema 中設置，這裡只是記錄）
-- ALTER TABLE "Partner" ALTER COLUMN "referralPlatformFee" SET DEFAULT 15.00;
-- ALTER TABLE "Partner" ALTER COLUMN "referralBonusPercentage" SET DEFAULT 0.00;
