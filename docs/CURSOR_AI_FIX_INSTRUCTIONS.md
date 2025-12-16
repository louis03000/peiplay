# Cursor AI 完整修復指令 - Pre-Chat 效能優化

## 🎯 目標

修復 PeiPlay pre-chat 輪詢延遲與重複請求問題，實作 meta endpoint、migration、前端 hook 優化、Redis 快取（可選）、session 優化建議，以及測試腳本。

**目標效能：**
- 聊天室開啟與訊息更新：≤ 2 秒（理想情況）
- 短輪詢回應：< 500ms（絕大多數情況）
- Meta endpoint：< 50ms（本地開發）

## 📋 完整任務清單

### 1. 資料庫 Migration

**檔案：** `prisma/migrations/add_pre_chat_meta_fields.sql`

**SQL 內容：**
```sql
-- 新增 meta 欄位以優化輪詢效能
ALTER TABLE pre_chat_rooms
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS message_count INT NOT NULL DEFAULT 0;

-- 更新現有資料（如果有舊資料）
UPDATE pre_chat_rooms
SET 
  last_message_at = (
    SELECT MAX(created_at)
    FROM pre_chat_messages
    WHERE room_id = pre_chat_rooms.id
  ),
  message_count = (
    SELECT COUNT(*)
    FROM pre_chat_messages
    WHERE room_id = pre_chat_rooms.id
  )
WHERE last_message_at IS NULL;

-- 確保索引（查 meta 要快）
CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_lastmsg 
  ON pre_chat_rooms (last_message_at);

CREATE INDEX IF NOT EXISTS idx_pre_chat_rooms_msgcount 
  ON pre_chat_rooms (message_count);
```

**驗收：** Migration 執行成功，資料表有 `last_message_at` 和 `message_count` 欄位

---

### 2. 更新 Prisma Schema

**檔案：** `prisma/schema.prisma`

**修改：** 在 `PreChatRoom` model 中新增：
```prisma
lastMessageAt DateTime? @map("last_message_at") @db.Timestamptz
```

並在 `@@index` 中添加：
```prisma
@@index([lastMessageAt])
@@index([messageCount])
```

**驗收：** `npx prisma generate` 執行成功

---

### 3. 新增 Meta Endpoint

**檔案：** `app/api/chatrooms/[chatId]/meta/route.ts`

**功能：**
- 驗證 session
- 檢查 roomId 授權
- 只查詢 `pre_chat_rooms` 表（單表查詢，使用索引）
- 回傳 `{ lastMessageAt, messageCount, isClosed }`

**要求：**
- 回應時間 < 50ms（本地開發）
- 不使用 JOIN 或 COUNT
- 只 SELECT 必要欄位

**驗收：**
```bash
time curl -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  http://localhost:3000/api/chatrooms/{chatId}/meta
# 應該 < 0.1s
```

---

### 4. 優化 POST Messages API

**檔案：** `app/api/chatrooms/[chatId]/messages/route.ts` (POST)

**功能：**
- 驗證 session 與授權
- Server 端 Regex 過濾（阻擋 http(s) link, @username, email, instagram|line|telegram）
- 使用 DB transaction：
  ```sql
  BEGIN;
  INSERT INTO pre_chat_messages (...);
  UPDATE pre_chat_rooms 
    SET last_message_at = NOW(), 
        message_count = message_count + 1 
    WHERE id = $1;
  IF message_count >= 10 THEN
    UPDATE pre_chat_rooms SET status = 'locked' WHERE id = $1;
  END IF;
  COMMIT;
  ```
- 回傳最小資料：`{ messageId, createdAt }`

**要求：**
- 不要做任何 COUNT(*) 全表掃描
- 在同一 transaction 更新 meta

**驗收：** 發送訊息後，檢查 DB：
```sql
SELECT last_message_at, message_count FROM pre_chat_rooms WHERE id = 'chatId';
-- 應該已更新
```

---

### 5. 優化 GET Messages API

**檔案：** `app/api/chatrooms/[chatId]/messages/route.ts` (GET)

**優化：**
- 使用 `select` 只查詢必要欄位
- 使用索引 `(room_id, created_at DESC)`
- 不要做 COUNT 或全表掃描

**SQL 查詢：**
```sql
SELECT id, sender_type, content, created_at
FROM pre_chat_messages
WHERE room_id = $1
  AND (created_at > $2 OR $2 IS NULL)
ORDER BY created_at DESC
LIMIT $limit;
```

---

### 6. 前端 Polling Hook 優化

**檔案：** `app/pre-chat/[chatId]/page.tsx`

**邏輯：**
```typescript
// 1. 使用 useRef 維護狀態
const pollingInFlight = useRef(false);
const lastMetaAt = useRef<string | null>(null);
const stoppedRef = useRef(false);

// 2. Poll 函數（確保單一 in-flight）
const pollOnce = async () => {
  if (pollingInFlight.current || stoppedRef.current) return;
  pollingInFlight.current = true;
  
  try {
    // 先 fetch meta
    const metaRes = await fetch(`/api/chatrooms/${chatId}/meta`);
    const meta = await metaRes.json();
    
    // 只有當 meta 改變時才拉取訊息
    if (meta.lastMessageAt !== lastMetaAt.current) {
      lastMetaAt.current = meta.lastMessageAt;
      
      // 拉取完整訊息
      const messagesRes = await fetch(`/api/chatrooms/${chatId}/messages?limit=10`);
      const data = await messagesRes.json();
      // 更新 state...
    }
  } finally {
    pollingInFlight.current = false;
    
    // 繼續輪詢（根據可見性調整間隔）
    if (!stoppedRef.current) {
      const delay = document.hidden ? 15000 : 3000;
      setTimeout(pollOnce, delay);
    }
  }
};

// 3. Visibility API
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !pollingInFlight.current) {
    pollOnce();
  }
});

// 4. Cleanup
return () => {
  stoppedRef.current = true;
  pollingInFlight.current = false;
  // 清除所有 timeout
};
```

**要求：**
- ✅ 確保只有一個 poll in-flight
- ✅ 先 meta 再 messages
- ✅ 使用 Visibility API
- ✅ Component unmount 時正確清理

**驗收：** Network 面板只看到：
- 每 3 秒一個 `meta` 請求
- 只有當有新訊息時才看到 `messages` 請求
- 不應該看到多個重複的 `messages?since=` 請求

---

### 7. Redis 快取（可選，強烈建議）

**檔案：** `app/api/chatrooms/[chatId]/meta/route.ts`

**邏輯：**
```typescript
// 如果有 REDIS_URL
if (process.env.REDIS_URL) {
  const cacheKey = `prechat:meta:${chatId}`;
  
  // 先查 Redis
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), {
      headers: { 'X-Cache': 'HIT' }
    });
  }
  
  // 查 DB
  const meta = await db.query(...);
  
  // 存入 Redis（TTL: 25 小時）
  await redis.setex(cacheKey, 90000, JSON.stringify(meta));
  
  return NextResponse.json(meta, {
    headers: { 'X-Cache': 'MISS' }
  });
}
```

**在 POST messages 時清除快取：**
```typescript
// 在 app/api/chatrooms/[chatId]/messages/route.ts (POST)
if (process.env.REDIS_URL) {
  await redis.del(`prechat:meta:${chatId}`);
}
```

**環境變數：**
```env
REDIS_URL=redis://localhost:6379
```

---

### 8. Session 優化建議（文檔）

**檔案：** `docs/SESSION_OPTIMIZATION.md`

**內容：**
如果當前 session 存儲在 DB 中，每次輪詢都要查 DB，建議：

1. **遷移到 Redis Session Store**
   ```typescript
   import RedisStore from 'connect-redis';
   import { createClient } from 'redis';
   
   const redisClient = createClient({ url: process.env.REDIS_URL });
   await redisClient.connect();
   
   const sessionStore = new RedisStore({ client: redisClient });
   ```

2. **或使用 JWT Cookie**
   - 使用 signed cookie，無需查 DB
   - 每次請求只需驗證簽名

3. **或 Cache Session Lookup**
   - 使用 Redis 快取 session 查詢結果
   - TTL: 5 分鐘

---

### 9. 測試腳本

**檔案：** `scripts/test-pre-chat-performance.js`

**功能：**
- 測試 meta endpoint 回應時間
- 測試 POST message 是否更新 meta
- 驗證欄位存在性

**執行：**
```bash
node scripts/test-pre-chat-performance.js <chatId> [sessionToken]
```

---

## 🚀 執行步驟

### Step 1: 執行 Migration

在 Supabase SQL Editor 執行：
```sql
-- 複製 prisma/migrations/add_pre_chat_meta_fields.sql 的內容
```

### Step 2: 重新生成 Prisma Client

```bash
npx prisma generate
```

### Step 3: 設定環境變數（可選）

```env
# 如果使用 Redis
REDIS_URL=redis://localhost:6379

# Session secret（應該已存在）
NEXTAUTH_SECRET=your-secret
```

### Step 4: 提交變更

```bash
git add .
git commit -m "feat(prechat): optimize polling with meta endpoint"
git push
```

### Step 5: 測試

#### 本地測試 Meta Endpoint

```bash
# 需要有效的 session token
time curl -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  http://localhost:3000/api/chatrooms/{chatId}/meta

# 預期：< 0.1s
```

#### 測試前端

1. 打開瀏覽器開發工具 → Network 標籤
2. 進入預聊頁面
3. 觀察請求：
   - ✅ 每 3 秒一個 `meta` 請求
   - ✅ 只有當有新訊息時才看到 `messages` 請求
   - ❌ 不應該看到多個重複的 `messages?since=` 請求

#### 測試訊息更新

```bash
# 發送訊息
curl -X POST 'http://localhost:3000/api/chatrooms/{chatId}/messages' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: next-auth.session-token=YOUR_TOKEN' \
  -d '{"content":"測試訊息"}'

# 檢查 meta 是否更新
curl -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  http://localhost:3000/api/chatrooms/{chatId}/meta
```

---

## ✅ 驗收標準

### 必須通過

1. **Meta Endpoint 效能**
   - [ ] Local GET `/api/chatrooms/{chatId}/meta` 平均 < 100ms
   - [ ] 只查詢 `pre_chat_rooms` 表（檢查 DB 日誌）

2. **前端 Polling**
   - [ ] Network 面板只看到 meta poll（每 3 秒）
   - [ ] `messages` 請求只在有新訊息時出現
   - [ ] 沒有重複的 `messages?since=` 請求

3. **訊息更新**
   - [ ] POST message 後，`message_count` 遞增
   - [ ] POST message 後，`last_message_at` 更新
   - [ ] 達到 10 則訊息時自動鎖定

4. **可見性優化**
   - [ ] 背景頁面時，poll 間隔延長到 15 秒
   - [ ] 頁面顯示時，立即恢復 3 秒間隔

### 可選（如果有 Redis）

5. **Redis 快取**
   - [ ] Meta endpoint 回傳 `X-Cache: HIT` 或 `X-Cache: MISS`
   - [ ] 快取命中時回應時間 < 10ms

---

## 📊 預期改善

### 之前
- ❌ 每 3 秒查詢完整訊息列表（2-8 秒）
- ❌ 多個重複請求同時進行
- ❌ 每次都要掃描 `pre_chat_messages` 表

### 之後
- ✅ 每 3 秒只查詢 meta（< 50ms）
- ✅ 只有一個 poll in-flight
- ✅ 只有當有新訊息時才查詢完整列表
- ✅ Meta 查詢只掃描 `pre_chat_rooms` 表（有索引）

### 效能提升
- **請求數量：** 減少 90%+
- **資料庫壓力：** 大幅降低
- **回應時間：** Meta < 50ms，Messages < 500ms
- **網路流量：** 減少 80%+

---

## 🔧 故障排除

### Meta endpoint 返回 500

1. 檢查 migration 是否執行
2. 檢查 Prisma Client 是否重新生成
3. 檢查資料表是否有 `last_message_at` 欄位

### 前端仍然發出多個請求

1. 檢查 `pollingInFlight` ref 是否正確設定
2. 檢查 component 是否多次 mount
3. 檢查 cleanup 函數是否正確執行

### Meta 查詢很慢 (> 50ms)

1. 檢查索引是否建立：
   ```sql
   \d pre_chat_rooms
   -- 應該看到 idx_pre_chat_rooms_lastmsg
   ```

2. 執行 EXPLAIN ANALYZE：
   ```sql
   EXPLAIN ANALYZE
   SELECT id, last_message_at, message_count, status
   FROM pre_chat_rooms
   WHERE id = 'your-chat-id';
   -- 應該使用 Index Scan
   ```

---

## 📝 Commit 訊息範例

```bash
git commit -m "feat(prechat): add meta endpoint + optimize polling

- Add last_message_at and message_count fields to pre_chat_rooms
- Create meta endpoint for lightweight polling
- Optimize message insertion to update meta in same transaction
- Refactor frontend polling: meta-first approach with single in-flight guard
- Add Redis cache support for meta endpoint (optional)
- Add performance test script"
```

---

## 🎯 完成後檢查清單

- [ ] Migration 已執行
- [ ] Prisma Client 已重新生成
- [ ] Meta endpoint 回應時間 < 50ms
- [ ] 前端只發出 meta poll，沒有重複 messages 請求
- [ ] POST message 正確更新 meta
- [ ] 可見性 API 正常工作
- [ ] 所有測試通過

---

## 📚 相關文檔

- [預聊系統說明](./PRE_CHAT_SYSTEM.md)
- [效能優化詳情](./PRE_CHAT_OPTIMIZATION.md)
- [GitHub Actions 設定](./GITHUB_ACTIONS_SETUP.md)

