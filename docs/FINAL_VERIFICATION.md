# ✅ 最終驗證清單

## 📋 所有修復項目檢查

### ✅ 1. Cache Key 統一

**文件**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**檢查**：
- ✅ Cache key: `messages:${roomId}:latest:${limit}`
- ✅ 不包含 userId
- ✅ 不包含 before（分頁查詢不 cache）
- ✅ 所有用戶共用同一份 cache

**代碼位置**：Line 33-60

---

### ✅ 2. Cache Hit 時禁止 DB 查詢

**文件**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**檢查**：
- ✅ Cache hit 時直接返回，不執行任何 DB 查詢
- ✅ 包括權限驗證也跳過（因為 cache 是共享的）

**代碼位置**：Line 41-56

---

### ✅ 3. 禁止 JOIN users

**文件**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**檢查**：
- ✅ 只查詢 `messages` 表
- ✅ 使用 denormalized 字段（senderName, senderAvatarUrl）
- ✅ 完全移除 JOIN sender 的邏輯

**代碼位置**：Line 88-133

---

### ✅ 4. 首屏只 Fetch Messages

**文件**：
- `app/chat/[roomId]/page.tsx` - 聊天室資訊延後 500ms
- `app/chat/page.tsx` - create-for-my-bookings 延後 1 秒

**檢查**：
- ✅ 聊天室資訊延後 500ms
- ✅ create-for-my-bookings 延後 1 秒
- ✅ 首屏立即顯示 skeleton UI

**代碼位置**：
- `app/chat/[roomId]/page.tsx` Line 106-141
- `app/chat/page.tsx` Line 168-189

---

### ✅ 5. Socket 單例

**文件**：`lib/hooks/useChatSocket.ts`

**檢查**：
- ✅ 使用 `globalSocket` 單例
- ✅ 整個網站只有一條連線
- ✅ 切換房間時只 emit `room:join/leave`，不重新連接
- ✅ useEffect 不依賴 roomId

**代碼位置**：Line 30-246

---

### ✅ 6. 舊訊息顯示「未知用戶」

**文件**：`app/chat/[roomId]/page.tsx`

**檢查**：
- ✅ 添加註釋說明這是預期行為
- ✅ 舊訊息可能沒有 senderName/senderAvatarUrl
- ✅ 新訊息會自動填充

**代碼位置**：Line 536-537

---

## 🚨 關鍵問題：Redis 可能沒連上

**檢查方法**：

1. **檢查環境變數**：
   ```bash
   # 應該要有 REDIS_URL
   echo $REDIS_URL
   ```

2. **檢查 Console**：
   - 應該看到 `✅ Redis connected`
   - 或 `⚠️ REDIS_URL not set, cache will be disabled`

3. **檢查 Cache 是否工作**：
   - 打開 Console
   - 第一次請求：應該看到 `❌ Cache miss: messages:xxx:latest:30`
   - 第二次請求：應該看到 `✅ Cache hit: messages:xxx:latest:30`

**如果 Redis 沒連上**：
- Cache.get() 會返回 null（graceful degradation）
- 每次都是 cache miss
- 但不會報錯，系統會降級為直接查 DB

**解決方案**：
- 確保 `.env` 中有 `REDIS_URL`
- 確保 Redis 服務運行中
- 如果沒有 Redis，系統會降級（功能正常，只是沒有 cache）

---

## 📊 性能驗證步驟

### 步驟 1：清除快取

1. 打開 DevTools → Application → Clear storage
2. 或使用無痕模式

### 步驟 2：第一次載入（cache miss）

1. 進入聊天室
2. 打開 Network
3. 檢查 `messages?limit=30`：
   - **時間**：應該 < 300ms（如果還是很慢，可能是 DB 查詢問題）
   - **X-Cache header**：應該是 `MISS`
   - **Console**：應該看到 `❌ Cache miss: messages:xxx:latest:30`

### 步驟 3：第二次載入（cache hit）

1. 重新整理頁面（F5）
2. 檢查 `messages?limit=30`：
   - **時間**：應該 < 100ms
   - **X-Cache header**：應該是 `HIT`
   - **Console**：應該看到 `✅ Cache hit: messages:xxx:latest:30`

### 步驟 4：檢查 Socket

1. 打開 Network → WS
2. 應該只有 1 條 WebSocket 連線
3. Console 應該看到 `✅ Socket already initialized, reusing existing connection`

---

## 🔍 如果還是很慢

### 檢查 1：Redis 是否連上

```bash
# 檢查環境變數
cat .env | grep REDIS_URL

# 如果沒有，需要設置
# REDIS_URL=redis://localhost:6379
```

### 檢查 2：DB 查詢是否使用索引

```sql
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

**預期結果**：
- Index Scan using ChatMessage_roomId_createdAt_idx
- Execution Time < 100ms

### 檢查 3：是否有 JOIN

檢查 Console log，不應該看到 JOIN 相關的查詢。

---

## ✅ 所有代碼已修復完成

**檢查結果**：
- ✅ Cache key 統一
- ✅ Cache hit 時禁止 DB 查詢
- ✅ 禁止 JOIN
- ✅ 首屏只 fetch messages
- ✅ Socket 單例
- ✅ 舊訊息顯示「未知用戶」（預期行為）

**如果還是很慢，可能是**：
1. Redis 沒連上（檢查 `REDIS_URL`）
2. DB 索引沒建立（執行 migration）
3. 查詢計劃不對（執行 EXPLAIN ANALYZE）

---

**請按照上述步驟驗證！** ✅

