# 預聊系統效能優化實作

## ✅ 已完成的優化

### 1. Meta Endpoint（關鍵優化）

**新增 API：** `GET /api/chatrooms/{chatId}/meta`

**功能：**
- 只查詢 `pre_chat_rooms` 表（極快，使用索引）
- 回傳 `{ lastMessageAt, messageCount, isClosed }`
- 回應時間 < 50ms（目標）

**用途：**
- 前端輪詢時先檢查 meta
- 只有當 `lastMessageAt` 改變時才拉取完整訊息
- 大幅減少資料庫查詢和網路傳輸

### 2. 資料庫優化

**新增欄位：**
- `last_message_at TIMESTAMPTZ` - 最後訊息時間
- `message_count INT` - 訊息數量（已存在，但現在會自動更新）

**新增索引：**
- `idx_pre_chat_rooms_lastmsg` - 加速 meta 查詢
- `idx_pre_chat_rooms_msgcount` - 加速計數查詢

**Migration 文件：** `prisma/migrations/add_pre_chat_meta_fields.sql`

### 3. 訊息插入優化

**修改：** `POST /api/chatrooms/{chatId}/messages`

**改進：**
- 在同一 transaction 中更新 `last_message_at` 和 `message_count`
- 避免額外的 COUNT 查詢
- 達到 10 則訊息時自動鎖定房間

### 4. 前端輪詢優化

**改進：**
- ✅ 確保只有一個 poll in-flight（使用 `isPollingRef`）
- ✅ 先 fetch meta → 若 changed 才 fetch messages
- ✅ 使用 Visibility API 調整輪詢間隔
- ✅ Component unmount 時正確清理

**流程：**
```
1. 每 3 秒 fetch /api/chatrooms/{chatId}/meta
2. 比較 lastMessageAt 是否改變
3. 如果有改變 → fetch /api/chatrooms/{chatId}/messages
4. 如果沒改變 → 跳過，繼續輪詢 meta
```

## 📊 效能提升

### 之前（問題）
- ❌ 每 3 秒都查詢完整訊息列表
- ❌ 可能同時發出多個重複請求
- ❌ 每次都要掃描 `pre_chat_messages` 表

### 現在（優化後）
- ✅ 每 3 秒只查詢 meta（極快，< 50ms）
- ✅ 只有當有新訊息時才查詢完整列表
- ✅ 確保單一 in-flight poll
- ✅ Meta 查詢只掃描 `pre_chat_rooms` 表（有索引）

### 預期效果
- **請求數量：** 減少 90%+（大多數輪詢只查 meta）
- **資料庫壓力：** 大幅降低（避免重複 COUNT 和全表掃描）
- **回應時間：** Meta 查詢 < 50ms
- **網路流量：** 減少 80%+（大多數輪詢只回傳 3 個欄位）

## 🚀 部署步驟

### 1. 執行資料庫 Migration

在 Supabase SQL Editor 執行：

```sql
-- 複製 prisma/migrations/add_pre_chat_meta_fields.sql 的內容
-- 執行 SQL
```

### 2. 重新生成 Prisma Client

```bash
npx prisma generate
```

### 3. 提交並推送

```bash
git add .
git commit -m "feat(prechat): add meta endpoint + optimize polling"
git push
```

### 4. 驗證

#### 測試 Meta Endpoint

```bash
# 使用 curl 測試（需要有效的 session）
curl -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  https://your-domain.com/api/chatrooms/{chatId}/meta
```

**預期回應：**
```json
{
  "lastMessageAt": "2025-12-16T03:34:54.906Z",
  "messageCount": 5,
  "isClosed": false
}
```

**驗收標準：**
- ✅ 回應時間 < 50ms
- ✅ 包含所有必要欄位
- ✅ 只查詢 `pre_chat_rooms` 表（檢查 DB 日誌）

#### 測試前端

1. 打開瀏覽器開發工具 → Network 標籤
2. 進入預聊頁面
3. 觀察請求：
   - ✅ 應該看到每 3 秒一個 `meta` 請求
   - ✅ 只有當有新訊息時才看到 `messages` 請求
   - ✅ 不應該看到多個重複的 `messages?since=` 請求

## 🔍 監控建議

### 檢查 Meta Endpoint 效能

在 Supabase SQL Editor 執行：

```sql
EXPLAIN ANALYZE
SELECT id, last_message_at, message_count, status
FROM pre_chat_rooms
WHERE id = 'your-chat-id';
```

**預期結果：**
- 應該使用索引掃描（Index Scan）
- 執行時間 < 1ms

### 檢查前端請求

在瀏覽器 Network 標籤：
- 過濾 `meta` 請求
- 檢查頻率（應該每 3 秒一次）
- 檢查回應時間（應該 < 50ms）

## 📝 後續優化（可選）

### 1. Redis 快取

如果使用 Redis，可以快取 `chat:meta:{chatId}`：
- TTL: 5 秒
- 更新訊息時清除快取

### 2. ETag / Last-Modified

在 meta endpoint 添加 HTTP 快取標頭：
- `ETag: {lastMessageAt}`
- `Last-Modified: {lastMessageAt}`

前端使用 `If-None-Match`，伺服器回傳 304 時可減少流量。

### 3. SSE / WebSocket

如果需要更即時的通訊，考慮：
- Server-Sent Events (SSE)
- WebSocket（注意 Vercel serverless 限制）

## ⚠️ 注意事項

1. **Migration 必須先執行**：否則 meta endpoint 會失敗
2. **Prisma Client 必須重新生成**：否則會找不到新欄位
3. **測試時檢查 Network 標籤**：確認沒有重複請求

## 🐛 故障排除

### Meta endpoint 返回 500

- 檢查 migration 是否執行
- 檢查 Prisma Client 是否重新生成
- 檢查資料表是否有 `last_message_at` 欄位

### 前端仍然發出多個請求

- 檢查 `isPollingRef` 是否正確設定
- 檢查 component 是否多次 mount
- 檢查 cleanup 函數是否正確執行

### Meta 查詢很慢 (> 50ms)

- 檢查索引是否建立
- 執行 `EXPLAIN ANALYZE` 查看查詢計劃
- 確認使用索引掃描而非全表掃描

