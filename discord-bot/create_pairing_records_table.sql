-- 創建 pairing_records 表格
CREATE TABLE IF NOT EXISTS pairing_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    extended_times INTEGER DEFAULT 0,
    duration INTEGER NOT NULL,
    rating INTEGER,
    comment TEXT,
    animal_name TEXT NOT NULL,
    booking_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_pairing_records_booking_id ON pairing_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_pairing_records_user1_id ON pairing_records(user1_id);
CREATE INDEX IF NOT EXISTS idx_pairing_records_user2_id ON pairing_records(user2_id);
CREATE INDEX IF NOT EXISTS idx_pairing_records_timestamp ON pairing_records(timestamp);
