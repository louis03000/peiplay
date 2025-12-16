-- 預聊系統資料表（極簡高效設計）
-- 設計原則：
-- 1. 不做真正聊天室
-- 2. 不支援歷史長查詢
-- 3. 不支援即時狀態
-- 4. 資料活不超過 24 小時
-- 5. 一個房間最多 10 則訊息

-- 1. 預聊房間表
CREATE TABLE IF NOT EXISTS pre_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'open',
  -- open | locked | expired
  
  message_count SMALLINT NOT NULL DEFAULT 0,
  
  expires_at TIMESTAMPTZ NOT NULL,  -- 建立時間 + 24 小時
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (user_id, partner_id)
);

-- 索引（效能關鍵）
CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_user
  ON pre_chat_rooms (user_id);

CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_partner
  ON pre_chat_rooms (partner_id);

CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_expires
  ON pre_chat_rooms (expires_at);

CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_status
  ON pre_chat_rooms (status);

-- 2. 預聊訊息表
CREATE TABLE IF NOT EXISTS pre_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  
  room_id UUID NOT NULL REFERENCES pre_chat_rooms(id) ON DELETE CASCADE,
  
  sender_type TEXT NOT NULL,
  -- 'user' | 'partner'
  
  content TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引（只留必要的）
CREATE INDEX IF NOT EXISTS idx_pre_chat_messages_room_time
  ON pre_chat_messages (room_id, created_at DESC);

-- 3. 自動過期清理函數（可選，用於定時清理）
-- 建議使用 cron job 或定時任務執行以下 SQL：
-- DELETE FROM pre_chat_rooms WHERE expires_at < now();

