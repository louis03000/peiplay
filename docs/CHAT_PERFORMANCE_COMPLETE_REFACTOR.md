# 🚀 聊天室性能全面重構完成

## ✅ 已完成的優化

### 1. Messages API 重構

**修改前**：
- 默認 limit = 30
- 查詢所有欄位（包括 contentType, status, moderationStatus）
- 使用 `before` 參數（不標準）

**修改後**：
- ✅ 默認 limit = **10**（首屏優化）
- ✅ 只 select 必要欄位：`id, roomId, senderId, senderName, senderAvatarUrl, content, createdAt`
- ✅ 使用 `cursor` 參數（標準 cursor-based pagination）
- ✅ 返回 `cursor` 供下次分頁使用

**代碼位置**：`app/api/chat/rooms/[roomId]/messages/route.ts`

**預期效果**：
- 查詢時間從 8 秒降至 < 200ms
- 資料傳輸量減少 60%+
- Cache key 改為 `messages:{roomId}:latest:10`

---

### 2. WebSocket 延後初始化

**修改前**：
- Socket 在頁面載入時立即連接
- 阻塞首屏渲染

**修改後**：
- ✅ Socket 只在 `messagesLoaded = true` 後才啟用
- ✅ 不阻塞首屏渲染

**代碼位置**：`app/chat/[roomId]/page.tsx`

```typescript
const [messagesLoaded, setMessagesLoaded] = useState(false);

useChatSocket({ 
  roomId, 
  enabled: !!roomId && messagesLoaded // ✅ 延後初始化
});
```

---

### 3. 首屏只載入必要內容

**修改前**：
- 同時載入：rooms, messages, bookings, profile, settings
- 所有 API 阻塞首屏

**修改後**：
- ✅ 首屏只載入：messages (limit=10)
- ✅ room info 延後 500ms
- ✅ create-for-my-bookings 延後 2 秒
- ✅ 其他 API（bookings, profile, settings）不在聊天室頁面載入

**代碼位置**：`app/chat/[roomId]/page.tsx`

---

### 4. 數據庫索引

**新增索引 SQL**：`prisma/migrations/add_chat_message_index.sql`

```sql
-- 複合索引：roomId + createdAt DESC（最關鍵）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- 索引：moderationStatus（過濾被拒絕的消息）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_moderationStatus_idx"
ON "ChatMessage"("moderationStatus")
WHERE "moderationStatus" != 'REJECTED';
```

**執行方法**：
```bash
# 連接到資料庫
psql $DATABASE_URL

# 執行 SQL
\i prisma/migrations/add_chat_message_index.sql
```

---

## 📊 預期性能提升

### Before（優化前）
- messages API: **8.14 秒**
- 首屏載入: **18+ 秒**
- 同時載入: 6+ 個 API

### After（優化後）
- messages API: **< 200ms**（目標）
- 首屏載入: **< 1 秒**（目標）
- 首屏只載入: 1 個 API（messages）

---

## 🔧 驗證步驟

### 1. 執行數據庫索引

```bash
psql $DATABASE_URL -f prisma/migrations/add_chat_message_index.sql
```

### 2. 檢查 messages API

打開 Network，檢查：
- `messages?limit=10` 應該 < 200ms
- 應該看到 `X-Cache: HIT`（第二次請求）
- 應該只 select 必要欄位

### 3. 檢查首屏載入

打開 Network，檢查：
- 首屏應該只看到 `messages?limit=10`
- `create-for-my-bookings` 應該在 2 秒後才執行
- Socket 應該在 messages 載入後才連接

### 4. 檢查 Console 日誌

應該看到：
- `📥 Loading messages for room: xxx (limit=10 for fast first screen)`
- `✅ Messages loaded, enabling socket...`
- `⏰ Delayed: Creating rooms for bookings (non-blocking)`

---

## 🚨 如果還是很慢

### 檢查 1：數據庫索引是否建立

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
AND indexname LIKE 'ChatMessage_%';
```

應該看到：
- `ChatMessage_roomId_createdAt_idx`
- `ChatMessage_moderationStatus_idx`

### 檢查 2：查詢計劃

```sql
EXPLAIN ANALYZE
SELECT id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;
```

應該看到：
- `Index Scan using ChatMessage_roomId_createdAt_idx`
- `Execution Time: < 200ms`

### 檢查 3：Redis Cache

檢查 Console，應該看到：
- `❄️ messages cache MISS`（第一次）
- `🔥 messages cache HIT`（第二次）

---

## ✅ 所有優化已完成

**下一步**：
1. 執行數據庫索引 migration
2. 刷新頁面測試
3. 檢查 Network 面板確認性能提升

**預期結果**：
- messages API < 200ms
- 首屏 < 1 秒
- Socket 不阻塞首屏

