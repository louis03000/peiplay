-- 確保 ChatMessage 表的性能索引存在
-- 這個 migration 確保聊天訊息查詢使用正確的複合索引

-- ChatMessage 的複合索引 (roomId, createdAt DESC)
-- 這個索引對於查詢特定聊天室的訊息非常關鍵
-- 如果索引已存在，CREATE INDEX IF NOT EXISTS 不會報錯
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" 
ON "ChatMessage"("roomId", "createdAt" DESC);

-- ChatMessage senderId 索引（用於查詢用戶發送的消息）
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_createdAt_idx" 
ON "ChatMessage"("senderId", "createdAt" DESC);

-- ChatMessage moderationStatus 索引（用於內容審查查詢）
CREATE INDEX IF NOT EXISTS "ChatMessage_moderationStatus_createdAt_idx" 
ON "ChatMessage"("moderationStatus", "createdAt" DESC);

-- ChatRoom 的 lastMessageAt 索引（用於排序聊天室列表）
CREATE INDEX IF NOT EXISTS "ChatRoom_lastMessageAt_idx" 
ON "ChatRoom"("lastMessageAt" DESC NULLS LAST);

-- ChatRoomMember 的複合索引（用於查詢用戶的聊天室成員資格）
CREATE INDEX IF NOT EXISTS "ChatRoomMember_userId_isActive_idx" 
ON "ChatRoomMember"("userId", "isActive");

