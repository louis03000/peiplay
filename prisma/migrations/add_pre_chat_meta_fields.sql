-- 新增 meta 欄位以優化輪詢效能
-- 目標：讓 meta endpoint 只查詢 pre_chat_rooms 表，極快

-- 1. 新增欄位
ALTER TABLE pre_chat_rooms
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS message_count INT NOT NULL DEFAULT 0;

-- 2. 更新現有資料（如果有舊資料）
UPDATE pre_chat_rooms
SET 
  last_message_at = (
    SELECT MAX(created_at)
    FROM pre_chat_messages
    WHERE room_id = pre_chat_rooms.id
  ),
  message_count = (
    SELECT COUNT(*)
    FROM pre_chat_messages
    WHERE room_id = pre_chat_rooms.id
  )
WHERE last_message_at IS NULL;

-- 3. 確保索引（查 meta 要快）
CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_lastmsg 
  ON pre_chat_rooms (last_message_at);

-- 注意：message_count 已有索引（透過 status 索引），但可以單獨加一個
CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_msgcount 
  ON pre_chat_rooms (message_count);

