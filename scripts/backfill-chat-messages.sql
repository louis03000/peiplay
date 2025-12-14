-- Backfill ChatMessage denormalized fields
-- ⚠️ 必須分批執行，避免 DB 負載過高
-- 建議：每次執行 1000 筆，sleep 300ms，重複直到 0 rows updated

-- 檢查進度
SELECT 
  COUNT(*) as total_messages,
  COUNT("senderName") as filled_name,
  COUNT("senderAvatarUrl") as filled_avatar,
  COUNT(*) - COUNT("senderName") as missing_name,
  COUNT(*) - COUNT("senderAvatarUrl") as missing_avatar
FROM "ChatMessage";

-- 分批更新（每次 1000 筆）
UPDATE "ChatMessage" m
SET 
  "senderName" = u.name,
  "senderAvatarUrl" = COALESCE(
    (SELECT "coverImage" FROM "Partner" WHERE "userId" = u.id),
    u.avatar
  )
FROM "User" u
WHERE m."senderId" = u.id
  AND (m."senderName" IS NULL OR m."senderAvatarUrl" IS NULL)
LIMIT 1000;

-- 驗證更新結果
SELECT 
  COUNT(*) as total_messages,
  COUNT("senderName") as filled_name,
  COUNT("senderAvatarUrl") as filled_avatar
FROM "ChatMessage";

