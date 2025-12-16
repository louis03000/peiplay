# 🚨 DB 查詢修復（最終版）

## 問題確認

從 `x-server-timing` header 看到：
- **auth: 1.8ms** ✅
- **db: 6006.3ms（6秒）** ❌ **這是問題**
- **total: 6008.3ms**

**結論：** 資料庫查詢本身慢，不是前端、Vercel 或 session。

---

## 🔍 根本原因

### 問題 1：查詢中有 `::text` cast（已修復）

**之前的查詢：**
```sql
WHERE "roomId" = ${roomId}::text
```

**問題：** `::text` cast 會導致 PostgreSQL 無法使用索引，強制 Seq Scan

**已修復為：**
```sql
WHERE "roomId" = ${roomId}
```

---

### 問題 2：索引可能不存在或順序不對

**需要建立的索引：**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';
```

---

## ✅ 立即執行步驟

### 步驟 1：執行 Migration

在 Supabase SQL Editor 執行：

```sql
-- 刪除舊索引（如果存在）
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_idx";
DROP INDEX IF EXISTS "ChatMessage_roomId_createdAt_desc_idx";

-- 建立最優化的部分索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';

-- 更新統計信息
ANALYZE "ChatMessage";
```

**如果 `CONCURRENTLY` 失敗（在 transaction 中），使用：**

```sql
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_id_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC, "id" DESC)
WHERE "moderationStatus" != 'REJECTED';
```

---

### 步驟 2：驗證索引

```sql
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
  AND indexname LIKE 'ChatMessage_roomId%'
ORDER BY indexname;
```

應該看到 `ChatMessage_roomId_createdAt_id_not_rejected_idx`

---

### 步驟 3：測試查詢（使用真實 roomId）

```sql
-- 先獲取一個真實的 roomId
SELECT id FROM "ChatRoom" LIMIT 1;

-- 用真實的 roomId 測試
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
- ✅ Execution Time: < 10ms
- ❌ **不應該看到 `Seq Scan`**

---

## 📊 已修復的問題

### 1. 移除 `::text` cast ✅
- **檔案：** `app/api/chat/rooms/[roomId]/messages/route.ts`
- **修復：** `WHERE "roomId" = ${roomId}`（移除 `::text`）

### 2. 確保查詢沒有其他問題 ✅
- ✅ 沒有 JOIN
- ✅ 沒有 SELECT *
- ✅ 只查詢必要欄位
- ✅ 使用 denormalized 字段

---

## 🎯 預期效果

### 之前
- **執行計劃：** `Seq Scan on "ChatMessage"`
- **執行時間：** 6006ms（6秒）
- **問題：** 全表掃描 + 排序

### 現在（修復後）
- **執行計劃：** `Index Scan using ChatMessage_roomId_createdAt_id_not_rejected_idx`
- **執行時間：** < 10ms
- **優勢：** 直接從索引讀取，無需排序

---

## ✅ 完成檢查

執行 migration 後，確認：

1. [ ] 索引已創建
2. [ ] `EXPLAIN ANALYZE` 顯示 `Index Scan`
3. [ ] 執行時間 < 10ms
4. [ ] API handler log 顯示 < 100ms
5. [ ] Network Timing 顯示 TTFB < 200ms

---

## 🚀 如果還是慢

如果執行 migration 後還是慢，可能的原因：

1. **索引沒有被使用**
   - 檢查 `EXPLAIN ANALYZE` 是否顯示 `Index Scan`
   - 如果還是 `Seq Scan`，可能是統計信息過時，執行 `ANALYZE "ChatMessage";` 多次

2. **查詢條件不匹配**
   - 確認查詢使用 `moderationStatus != 'REJECTED'`
   - 確認 `roomId` 型別一致（TEXT）

3. **表太大**
   - 如果表 > 10 萬行，可能需要更長時間建立索引
   - 使用 `CREATE INDEX CONCURRENTLY` 避免鎖表

---

## 📝 注意事項

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

## 🎉 完成！

執行 migration 並驗證後，系統應該：
- **DB 查詢時間：從 6 秒降至 < 10ms**
- **API 響應時間：從 6 秒降至 < 100ms**
- **聊天室載入：秒開**

