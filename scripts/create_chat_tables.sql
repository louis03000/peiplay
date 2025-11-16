-- 創建聊天系統所需的資料表
-- 如果 migration 失敗，可以手動執行此 SQL

-- 創建 enum 類型（如果不存在）
DO $$ BEGIN
  CREATE TYPE "ChatRoomType" AS ENUM ('ONE_ON_ONE', 'GROUP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageContentType" AS ENUM ('TEXT', 'IMAGE', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 創建 ChatRoom 表
CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" "ChatRoomType" NOT NULL DEFAULT 'ONE_ON_ONE',
  "bookingId" TEXT UNIQUE,
  "groupBookingId" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  CONSTRAINT "ChatRoom_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ChatRoom_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 創建 ChatRoomMember 表
CREATE TABLE IF NOT EXISTS "ChatRoomMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ChatRoomMember_roomId_userId_key" UNIQUE ("roomId", "userId"),
  CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 創建 ChatMessage 表
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentType" "MessageContentType" NOT NULL DEFAULT 'TEXT',
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "moderationReason" TEXT,
  "moderationScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 創建 MessageReadReceipt 表
CREATE TABLE IF NOT EXISTS "MessageReadReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReadReceipt_messageId_userId_key" UNIQUE ("messageId", "userId"),
  CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 創建索引
CREATE INDEX IF NOT EXISTS "ChatRoom_bookingId_idx" ON "ChatRoom"("bookingId");
CREATE INDEX IF NOT EXISTS "ChatRoom_groupBookingId_idx" ON "ChatRoom"("groupBookingId");
CREATE INDEX IF NOT EXISTS "ChatRoom_lastMessageAt_idx" ON "ChatRoom"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");
CREATE INDEX IF NOT EXISTS "ChatRoomMember_roomId_idx" ON "ChatRoomMember"("roomId");
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");
CREATE INDEX IF NOT EXISTS "ChatMessage_moderationStatus_idx" ON "ChatMessage"("moderationStatus");
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_status_idx" ON "ChatMessage"("roomId", "status");
CREATE INDEX IF NOT EXISTS "MessageReadReceipt_userId_idx" ON "MessageReadReceipt"("userId");
CREATE INDEX IF NOT EXISTS "MessageReadReceipt_messageId_idx" ON "MessageReadReceipt"("messageId");

