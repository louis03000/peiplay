# 🚨 緊急修復步驟

## 問題診斷

從截圖看到：
1. ❌ 查詢計劃顯示 `Seq Scan`（沒有使用索引）
2. ❌ Network 面板顯示 `messages?limit=10` 還是很慢（6-9 秒）
3. ❌ 前端可能沒有使用 meta-first polling（或 WebSocket 已連接）

---

## ✅ 立即執行（按順序）

### 步驟 1：創建索引（最重要）

在 Supabase SQL Editor 執行：

```sql
-- 刪除舊索引（如果存在）
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_idx";

-- 創建最優化的部分索引（不使用 CONCURRENTLY，因為可能在 transaction 中）
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- 更新統計信息（關鍵！）
ANALYZE "ChatMessage";
```

**如果失敗，嘗試：**

```sql
-- 先檢查表大小
SELECT COUNT(*) FROM "ChatMessage";

-- 如果表很大（> 1000 行），使用 CONCURRENTLY（需要分開執行，不在 transaction 中）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';
```

### 步驟 2：驗證索引

```sql
-- 檢查索引是否存在
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
  AND indexname LIKE 'ChatMessage_roomId%'
ORDER BY indexname;
```

應該看到 `ChatMessage_roomId_createdAt_id_not_rejected_idx`

### 步驟 3：測試查詢（使用真實 roomId）

```sql
-- 先獲取一個真實的 roomId
SELECT id FROM "ChatRoom" LIMIT 1;

-- 用真實的 roomId 測試（替換 'your-room-id'）
EXPLAIN ANALYZE
SELECT 
  id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = '真實的-room-id'  -- 替換這裡
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;
```

**預期結果：**
- ✅ `Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx`
- ✅ 執行時間：< 1ms（表小時）或 < 100ms（表大時）
- ❌ **不應該看到 `Seq Scan`**

### 步驟 4：如果還是 Seq Scan

可能的原因：
1. **表太小**：PostgreSQL 認為全表掃描更快（< 10 行）
2. **統計信息過時**：執行 `ANALYZE "ChatMessage";` 多次
3. **查詢條件不匹配**：確認使用 `moderationStatus != 'REJECTED'`

**強制使用索引（測試用）：**

```sql
SET enable_seqscan = off;

EXPLAIN ANALYZE
SELECT id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = '真實的-room-id'
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;

SET enable_seqscan = on;
```

---

## 🔍 為什麼 Network 面板還是慢？

從 Network 面板看到 `messages?limit=10` 還是 6-9 秒，可能的原因：

### 1. 前端沒有使用 meta-first polling
**檢查：**
- 打開 Console，查看是否有 meta 請求
- 如果只有 `messages?limit=10` 請求，表示沒有使用 meta-first

**原因：**
- WebSocket 已連接，所以沒有啟用 polling
- 但初始載入時還是直接查 messages

**解決：**
- 初始載入也應該先查 meta
- 或者確保 WebSocket 連接前也使用 meta-first

### 2. 其他瓶頸
- **Session 驗證**：已優化，但可能還有問題
- **資料庫連線**：Vercel serverless 冷啟動
- **多個重複請求**：檢查是否有並發請求

---

## 📊 檢查清單

執行以下檢查：

1. [ ] 索引已創建
2. [ ] `EXPLAIN ANALYZE` 顯示 `Index Scan`
3. [ ] 查詢時間 < 100ms
4. [ ] Network 面板看到 meta 請求（每 2.5 秒）
5. [ ] 只有當有新訊息時才看到 messages 請求
6. [ ] 沒有重複的 messages 請求

---

## 🎯 如果還是慢

如果執行以上步驟後還是慢，可能的原因：

1. **Vercel Cold Start**：第一個請求會很慢（3-5 秒）
   - 解決：使用常駐主機（Render / Fly）或 Edge Functions

2. **資料庫連線**：每次請求建立新連線
   - 解決：使用連線池

3. **Session 驗證**：雖然已優化，但可能還有問題
   - 檢查：在 API 中添加 timing logs

4. **前端重複請求**：多個組件同時請求
   - 檢查：Network 面板是否有重複請求

---

## ✅ 完成後

執行所有步驟後，應該看到：
- ✅ 查詢使用 Index Scan
- ✅ 查詢時間 < 100ms
- ✅ Network 面板主要看到 meta 請求
- ✅ messages 請求只在有新訊息時出現

