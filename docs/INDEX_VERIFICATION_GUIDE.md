# 索引驗證指南

## 📋 檢查清單

### 1. ChatMessage 表索引

#### 必要索引
- [x] `ChatMessage_roomId_createdAt_desc_idx` - 基礎複合索引
- [x] `ChatMessage_roomId_createdAt_not_rejected_idx` - 部分索引（過濾 REJECTED）
- [x] `ChatMessage_roomId_createdAt_id_not_rejected_idx` - 包含 id 的部分索引

#### 驗證方法
```sql
-- 檢查所有 ChatMessage 索引
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
  AND indexname LIKE 'ChatMessage_roomId%'
ORDER BY indexname;
```

#### 預期結果
應該看到至少 3 個索引：
1. `ChatMessage_roomId_createdAt_desc_idx`
2. `ChatMessage_roomId_createdAt_not_rejected_idx` (partial index)
3. `ChatMessage_roomId_createdAt_id_not_rejected_idx` (partial index)

---

### 2. PreChatMessage 表索引

#### 必要索引
- [x] `idx_pre_chat_messages_room_time` - 複合索引

#### 驗證方法
```sql
-- 檢查 PreChatMessage 索引
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'pre_chat_messages' 
  AND indexname = 'idx_pre_chat_messages_room_time';
```

---

## 🧪 效能測試

### 測試 ChatMessage 查詢

```sql
-- 測試查詢（應該使用 Index Scan）
EXPLAIN ANALYZE
SELECT 
  id,
  "roomId",
  "senderId",
  "senderName",
  "senderAvatarUrl",
  content,
  "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;
```

#### 預期結果
- **執行計劃：** `Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx`
- **執行時間：** < 100ms
- **不應該看到：** `Seq Scan` 或 `Sort`

---

### 測試 PreChatMessage 查詢

```sql
-- 測試查詢（應該使用 Index Scan）
EXPLAIN ANALYZE
SELECT 
  id,
  room_id,
  sender_type,
  content,
  created_at
FROM pre_chat_messages
WHERE room_id = 'your-room-id'
ORDER BY created_at DESC
LIMIT 10;
```

#### 預期結果
- **執行計劃：** `Index Scan using idx_pre_chat_messages_room_time`
- **執行時間：** < 50ms
- **不應該看到：** `Seq Scan` 或 `Sort`

---

## 🚀 執行 Migration

### 方法 1：在 Supabase Dashboard 執行

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的專案
3. 點擊左側的 "SQL Editor"
4. 點擊 "New query"
5. 複製以下 migration 內容並貼上：
   - `prisma/migrations/ensure_chat_message_composite_indexes.sql`
   - `prisma/migrations/ensure_pre_chat_message_index.sql`
6. 點擊 "Run" 執行
7. 確認看到 "Success" 訊息

### 方法 2：使用 psql

```bash
# 連接到資料庫
psql $DATABASE_URL

# 執行 migration
\i prisma/migrations/ensure_chat_message_composite_indexes.sql
\i prisma/migrations/ensure_pre_chat_message_index.sql
```

---

## ⚠️ 注意事項

1. **CONCURRENTLY 選項：** 
   - 如果表很大，建議使用 `CREATE INDEX CONCURRENTLY`（不會鎖表）
   - 但 `CONCURRENTLY` 不能在 transaction 中使用

2. **索引大小：**
   - 部分索引（partial index）通常比完整索引小
   - 如果大部分訊息都是 REJECTED，部分索引會大幅減少索引大小

3. **維護成本：**
   - 索引會增加寫入成本（INSERT/UPDATE 需要更新索引）
   - 但對於讀多寫少的聊天系統，這是值得的

---

## 📊 效能提升

### 之前（沒有索引）
- **執行計劃：** `Seq Scan`（全表掃描）
- **執行時間：** 2-9 秒（取決於表大小）
- **問題：** 每次查詢都要掃描整個表

### 現在（有索引）
- **執行計劃：** `Index Scan`（索引掃描）
- **執行時間：** < 100ms
- **優勢：** 只掃描相關的訊息

---

## ✅ 完成檢查

執行 migration 後，確認：

1. [ ] 所有索引都已創建
2. [ ] `EXPLAIN ANALYZE` 顯示使用 Index Scan
3. [ ] 查詢時間 < 100ms
4. [ ] 沒有看到 Seq Scan 或 Sort

如果所有檢查都通過，索引優化就完成了！

