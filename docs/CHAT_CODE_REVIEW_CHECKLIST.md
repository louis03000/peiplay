# ✅ 聊天室代碼檢查清單

## 🔍 逐項檢查

### ✅ 1. Cache Key 統一

**要求**：
- Cache key: `messages:${roomId}:latest:30`
- 所有用戶共用同一份 cache
- 不包含 userId
- 不包含 before（分頁查詢不 cache）

**檢查位置**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**代碼**：
```typescript
const cacheKey = before 
  ? null // 分頁查詢不 cache
  : `messages:${roomId}:latest:${limit}`;

if (cacheKey) {
  const cached = await Cache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ messages: cached }, {
      headers: { 'X-Cache': 'HIT' }
    });
  }
}
```

**狀態**：✅ 已修復

---

### ✅ 2. Cache Hit 時禁止 DB 查詢

**要求**：
- Cache hit 時直接返回，不執行任何 DB 查詢
- 包括權限驗證也要跳過（因為 cache 是共享的）

**檢查位置**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**代碼**：
```typescript
if (cached) {
  // ✅ cache hit：直接返回，禁止任何 DB 查詢
  return NextResponse.json({ messages: cached });
}
// 只有 cache miss 才執行下面的 DB 查詢
```

**狀態**：✅ 已修復

---

### ✅ 3. 禁止 JOIN users

**要求**：
- GET /messages 只查詢 `messages` 表
- 使用 denormalized 字段（senderName, senderAvatarUrl）
- 完全移除 JOIN users 的邏輯

**檢查位置**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**代碼**：
```typescript
const messages = await (client as any).chatMessage.findMany({
  where,
  select: {
    id: true,
    roomId: true,
    senderId: true,
    senderName: true,        // denormalized
    senderAvatarUrl: true,   // denormalized
    content: true,
    // ❌ 禁止 JOIN sender
  },
});
```

**狀態**：✅ 已修復（完全移除 JOIN）

---

### ✅ 4. 首屏只 Fetch Messages

**要求**：
- 聊天室資訊延後載入
- create-for-my-bookings 延後載入
- 其他 API 不阻塞首屏

**檢查位置**：
- `app/chat/[roomId]/page.tsx` - 聊天室資訊延後 500ms
- `app/chat/page.tsx` - create-for-my-bookings 延後 1 秒

**狀態**：✅ 已修復

---

### ✅ 5. Socket 單例

**要求**：
- 整個網站只有一條 socket 連線
- 使用 `globalSocket` 單例
- 切換房間時只 emit `room:join/leave`，不重新連接

**檢查位置**：`lib/hooks/useChatSocket.ts`

**代碼**：
```typescript
let globalSocket: Socket | null = null;

// ✅ 防止重複初始化
if (initializedRef.current && globalSocket) {
  // 重用現有連接
  return;
}

// 只初始化一次
if (!globalSocket) {
  globalSocket = io(socketUrl, {...});
}
```

**狀態**：✅ 已修復

---

### ✅ 6. 舊訊息顯示「未知用戶」

**要求**：
- 這是預期行為，不是 bug
- 舊訊息可能沒有 senderName/senderAvatarUrl
- 新訊息會自動填充

**檢查位置**：`app/chat/[roomId]/page.tsx`

**代碼**：
```typescript
// ⚠️ 舊訊息可能沒有 senderName，顯示「未知用戶」是預期行為
{message.senderName || message.sender?.name || '未知用戶'}
```

**狀態**：✅ 已修復（添加註釋說明）

---

## 🚨 潛在問題檢查

### 問題 1：Redis 可能沒連上

**檢查方法**：
```bash
# 檢查環境變數
echo $REDIS_URL

# 檢查 Redis 連線
redis-cli PING
```

**如果 Redis 沒連上**：
- Cache.get() 會返回 null
- 每次都是 cache miss
- 但不會報錯（graceful degradation）

**解決方案**：
- 確保 `.env` 中有 `REDIS_URL`
- 確保 Redis 服務運行中

---

### 問題 2：Cache Key 不一致

**檢查方法**：
```bash
# 檢查 Redis 中的 cache key
redis-cli
> KEYS messages:*
```

**預期結果**：
- 應該看到 `messages:room123:latest:30` 格式的 key
- 不應該有 `chat:messages:` 或包含 userId 的 key

---

### 問題 3：Socket 還是多條連線

**檢查方法**：
1. 打開 Network → WS
2. 進入聊天室
3. 切換房間
4. 檢查 WebSocket 連線數量

**預期結果**：
- 只有 1 條 WebSocket 連線
- 切換房間時不重新連接

---

## 📊 性能驗證

### 驗證步驟

1. **清除快取**：
   - 打開 DevTools → Application → Clear storage
   - 或使用無痕模式

2. **第一次載入**（cache miss）：
   - 進入聊天室
   - 檢查 messages API：
     - 時間：< 300ms
     - X-Cache: MISS
     - 檢查 Console：應該看到 `❌ Cache miss: messages:xxx:latest:30`

3. **第二次載入**（cache hit）：
   - 重新整理頁面
   - 檢查 messages API：
     - 時間：< 100ms
     - X-Cache: HIT
     - 檢查 Console：應該看到 `✅ Cache hit: messages:xxx:latest:30`

4. **Socket 連線**：
   - 檢查 Network → WS
   - 應該只有 1 條連線
   - Console 應該看到 `✅ Socket already initialized, reusing existing connection`

---

## 🔧 如果還是有問題

### Cache 沒 Hit

**可能原因**：
1. Redis 沒連上（檢查 `REDIS_URL`）
2. Cache key 不一致（檢查 Console log）
3. TTL 太短（目前是 3 秒）

**解決方案**：
- 檢查 Redis 連線
- 檢查 Console log 中的 cache key
- 如果 Redis 不可用，系統會降級（不會報錯）

### 還是很慢

**可能原因**：
1. DB 查詢還是用 JOIN（檢查 EXPLAIN ANALYZE）
2. 索引沒建立（檢查 migration）
3. 查詢計劃不對

**解決方案**：
```sql
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

**預期**：Index Scan，Execution Time < 100ms

---

**所有代碼已檢查並修復！** ✅

