# 🚀 聊天室效能修復 - 快速參考

> **完整版**：見 `CHAT_PERFORMANCE_COMPLETE_FIX.md`

---

## 📋 給 Cursor AI 的完整指令（一次貼上）

```
請依照 docs/CHAT_PERFORMANCE_COMPLETE_FIX.md 的完整指南，直接幫我完成聊天室效能優化的實作：

1. Frontend：
   - 立即 render ChatLayout + InputBar + MessageSkeleton（不阻塞）
   - Socket: 改為 singleton（只 connect 一次）
   - Avatar: 使用 CDN resize + <img loading="lazy">
   - 防重入：使用 initializedRef 與 request lock
   - 延後非必要 API（create-for-my-bookings 延後 1 秒）

2. Backend：
   - messages 表新增 sender_name, sender_avatar_url（提供 migration SQL）
   - POST /messages: 改為 insert-only + 把其他工作丟到 queue
   - GET /messages: 改為單表查詢 + Redis cache（TTL 3 秒）
   - 移除 messages 查詢中的任何 JOIN
   - 使用 cursor-based pagination（不使用 OFFSET）

3. Worker：
   - 建立 worker 處理：room.lastMessageAt、socket emit、cache invalidation
   - 使用 Bull + Redis

4. Cache & Infra：
   - 加入 Redis cache（key: messages:{roomId}:{limit}:{before}, TTL 3 秒）
   - 提供環境變數配置說明

5. Rate Limiting：
   - 實作 per-user token bucket (3 msgs/sec, burst 5)

6. 提供：
   - Migration SQL（標示需手動執行）
   - Backfill script
   - k6 壓測腳本
   - Rollback plan
   - 驗收測項（EXPLAIN 指令 & Network expectations）

請把所有變更做成 PR，並標示哪些 DB 指令須由 owner 在 maintenance window 手動執行。
```

---

## ⚡ 必須手動執行的步驟

### 1. Database Migration（Maintenance Window）

```sql
-- ⚠️ 必須在 maintenance window 執行
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- 驗證
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'test-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

### 2. 環境變數

```bash
# .env
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SOCKET_URL=wss://socket.peiplay.com
```

### 3. 部署 Worker

```bash
pm2 start workers/message-processor.ts --name message-worker
```

---

## ✅ 驗收標準（必須全部達成）

- [ ] 首屏（ChatLayout + InputBar）FCP < 500ms
- [ ] messages API (cache hit) < 150ms
- [ ] messages API (cache miss) < 300ms
- [ ] POST /messages latency < 200ms
- [ ] 首次完成到可互動 ≤ 2s
- [ ] 100 concurrent users：DB CPU < 70%，Redis hit ratio > 85%
- [ ] WebSocket 只有 1 連線 / client
- [ ] EXPLAIN ANALYZE 顯示 Index Scan

---

## 🔍 驗證指令

### Database

```sql
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

**預期**：Index Scan，Execution Time < 100ms

### API

```bash
# Cache miss
time curl "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages?limit=30"
# 預期：< 300ms

# Cache hit
time curl "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages?limit=30"
# 預期：< 100ms
```

### 壓測

```bash
k6 run k6/chat-load-test.js
```

**預期**：p95 < 500ms，error rate < 1%

---

## 📊 優先順序

1. ✅ 前端不阻塞 render
2. ✅ DB 索引 + denormalize
3. ✅ POST /messages 非同步化
4. ✅ Redis cache
5. ✅ Socket 單例
6. ✅ Rate limit
7. ✅ 前端防重入
8. ✅ Migration / 部署
9. ✅ 監控與壓測

---

**完整細節請見**：`docs/CHAT_PERFORMANCE_COMPLETE_FIX.md`

