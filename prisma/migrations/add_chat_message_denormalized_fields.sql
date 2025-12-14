-- 添加 ChatMessage denormalized 字段
-- 這是業界聊天系統標準做法：在 messages 表中直接存儲 sender_name 和 sender_avatar_url
-- 避免 JOIN users 表，大幅提升查詢效能（從秒級降到毫秒級）

-- 添加字段
ALTER TABLE "ChatMessage" 
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- 為現有數據填充 denormalized 字段（從 users 表更新）
-- 注意：這是一次性操作，之後新消息會在創建時自動填充
UPDATE "ChatMessage" cm
SET 
  "senderName" = u.name,
  "senderAvatarUrl" = COALESCE(
    (SELECT "coverImage" FROM "Partner" WHERE "userId" = u.id),
    (SELECT "avatar" FROM "User" WHERE "id" = u.id)
  )
FROM "User" u
WHERE cm."senderId" = u.id
  AND (cm."senderName" IS NULL OR cm."senderAvatarUrl" IS NULL);

-- 創建索引（確保查詢效能）
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" 
ON "ChatMessage"("roomId", "createdAt" DESC);

