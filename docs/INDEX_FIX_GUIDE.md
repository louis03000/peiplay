# 索引修復指南（緊急）

## 🚨 問題診斷

從查詢計劃看到：
- ❌ 使用 `Seq Scan`（全表掃描）
- ❌ 執行時間：0.084ms（但這是因為表很小，只有 5 行）
- ❌ 當表變大時，會變成秒級

## ✅ 解決步驟

### 步驟 1：執行 Migration

在 Supabase SQL Editor 執行：

```sql
-- 刪除舊索引（如果存在）
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_idx";

-- 創建最優化的部分索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- 更新統計信息（關鍵！）
ANALYZE "ChatMessage";
```

**注意：** 如果 `CONCURRENTLY` 失敗（在 transaction 中），使用：

```sql
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
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

-- 然後用真實的 roomId 測試
EXPLAIN ANALYZE
SELECT 
  id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = '真實的-room-id'  -- 替換為真實的 roomId
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;
```

**預期結果：**
- ✅ `Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx`
- ✅ 執行時間：< 1ms（當表小時）或 < 100ms（當表大時）
- ❌ 不應該看到 `Seq Scan`

### 步驟 4：如果還是使用 Seq Scan

可能的原因：
1. **表太小**：PostgreSQL 認為全表掃描更快（< 10 行）
2. **統計信息過時**：執行 `ANALYZE "ChatMessage";`
3. **查詢條件不匹配**：確認 `moderationStatus != 'REJECTED'` 條件

**強制使用索引（測試用）：**

```sql
-- 暫時禁用 Seq Scan（僅用於測試）
SET enable_seqscan = off;

EXPLAIN ANALYZE
SELECT id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = '真實的-room-id'
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;

-- 恢復設定
SET enable_seqscan = on;
```

---

## 🔍 為什麼查詢還是慢？

從 Network 面板看到 `messages?limit=10` 還是很慢（6-9 秒），可能的原因：

### 1. 索引沒有被使用
- ✅ 執行上面的 migration
- ✅ 驗證索引存在
- ✅ 更新統計信息

### 2. 查詢沒有使用原生 SQL
- 檢查 `app/api/chat/rooms/[roomId]/messages/route.ts`
- 確認使用 `$queryRaw` 而非 Prisma ORM

### 3. 其他瓶頸
- Session 驗證（已優化）
- 資料庫連線（可能冷啟動）
- Vercel serverless cold start

---

## 📊 效能對比

### 之前（Seq Scan）
- 執行計劃：`Seq Scan on "ChatMessage"`
- 執行時間：隨表大小線性增長
- 1000 行：~10ms
- 10000 行：~100ms
- 100000 行：~1 秒

### 現在（Index Scan）
- 執行計劃：`Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx`
- 執行時間：幾乎固定
- 1000 行：< 1ms
- 10000 行：< 5ms
- 100000 行：< 50ms

---

## ✅ 完成檢查

執行 migration 後，確認：

1. [ ] 索引已創建
2. [ ] `EXPLAIN ANALYZE` 顯示 `Index Scan`
3. [ ] 查詢時間 < 100ms（即使表很大）
4. [ ] Network 面板的 `messages?limit=10` 請求變快

如果所有檢查都通過，索引優化就完成了！

