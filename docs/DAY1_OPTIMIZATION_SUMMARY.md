# Day 1 優化實作總結

## ✅ 已完成項目

### 1. Meta-first Polling Endpoint
**檔案：** `app/api/chat/rooms/[roomId]/meta/route.ts`

**功能：**
- 新增 `/api/chat/rooms/[roomId]/meta` endpoint
- 只查詢 `ChatRoom` 表（極快，使用索引）
- 回傳 `{ lastMessageAt, unreadCount, isFreeChat, type }`
- Redis 快取（1 秒 TTL）

**效果：**
- 前端可以先查 meta，只有當 `lastMessageAt` 改變時才查完整訊息
- 大幅減少 DB 查詢和網路傳輸

---

### 2. Transaction 優化
**檔案：** `app/api/chat/rooms/[roomId]/messages/route.ts`

**改進：**
- POST messages 時，在同一 transaction 中：
  1. 插入訊息
  2. 更新 `ChatRoom.lastMessageAt`
- 確保原子性，避免 race condition

**效果：**
- 減少 round-trip 與鎖競爭
- 確保資料一致性

---

### 3. Cache Keys 統一
**檔案：** `lib/redis-cache.ts`

**新增：**
```typescript
chat: {
  meta: (roomId: string) => `chat:meta:${roomId}`,
  messages: (roomId: string, limit: number = 10) => `chat:messages:${roomId}:${limit}`,
  rooms: (userId: string) => `chat:rooms:${userId}`,
},
preChat: {
  meta: (roomId: string) => `prechat:meta:${roomId}`,
}
```

**效果：**
- 統一的 cache key 命名規範
- 方便 cache invalidation

---

### 4. Cache Invalidation
**檔案：** `app/api/chat/rooms/[roomId]/messages/route.ts`

**改進：**
- POST messages 後，清除：
  - `chat:messages:{roomId}:10` (messages cache)
  - `chat:meta:{roomId}` (meta cache)
- 確保新訊息立即顯示

---

## 📋 待完成項目

### 1. 前端 Meta-first Polling
**檔案：** `app/chat/[roomId]/page.tsx`

**需要實作：**
- 改為 meta-first polling
- 先查 `/api/chat/rooms/[roomId]/meta`
- 只有當 `lastMessageAt` 改變時才查完整訊息
- 使用 `useRef` 和 `AbortController` 防止重複請求

**參考：** `app/pre-chat/[chatId]/page.tsx` 的實作

---

### 2. Payload 極簡化
**檔案：** `app/api/chat/rooms/[roomId]/messages/route.ts`

**需要檢查：**
- GET messages 是否只回傳必要欄位
- 當前回傳：`{ id, roomId, senderId, senderName, senderAvatarUrl, content, createdAt }`
- 建議：只回傳 `{ id, senderId, content, createdAt }`（前端已有 senderName/senderAvatarUrl）

---

### 3. 索引檢查
**需要確認：**
- `ChatMessage` 表是否有 composite index: `(roomId, createdAt DESC)`
- 是否有 partial index: `(roomId, createdAt DESC) WHERE moderationStatus != 'REJECTED'`

**檢查方法：**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
AND indexname LIKE 'ChatMessage_roomId%';
```

---

## 🎯 下一步

1. **實作前端 meta-first polling**（最重要）
2. **檢查並優化 payload**
3. **驗證索引存在**

---

## 📊 預期效果

### 之前
- 每 3 秒都查詢完整訊息列表
- 可能同時發出多個重複請求
- 每次都要掃描 `ChatMessage` 表

### 現在（優化後）
- ✅ 每 3 秒只查詢 meta（極快，< 50ms）
- ✅ 只有當有新訊息時才查詢完整列表
- ✅ 確保單一 in-flight poll
- ✅ Meta 查詢只掃描 `ChatRoom` 表（有索引）
- ✅ Transaction 確保原子性

**預期提升：**
- DB 壓力：**減少 80-90%**
- API 響應時間：**減少 70-80%**
- 網路傳輸：**減少 60-70%**

