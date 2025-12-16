# 聊天室效能優化清單

## 🔴 緊急優化（立即見效）

### 1. Session 驗證優化 ⚡ **最大瓶頸**
**問題：** 每次 API 請求都要調用 `getServerSession(authOptions)`，如果使用 DB session store，每次都要查資料庫（~50-200ms）

**影響：** 所有 API 請求都變慢，特別是頻繁輪詢的聊天室

**解決方案：**
- **方案 A（推薦）：** 遷移到 Redis Session Store
  - 查詢速度：< 1ms（vs DB 的 50-200ms）
  - 實作時間：1-2 小時
  - 預期提升：**減少 50-200ms 延遲**

- **方案 B：** 使用 JWT Cookie（無狀態）
  - 查詢速度：0ms（無需查詢）
  - 實作時間：2-3 小時
  - 預期提升：**減少 50-200ms 延遲**

**實作步驟：** 見 `docs/SESSION_OPTIMIZATION.md`

---

### 2. 聊天室列表 API 優化 ⚡ **第二瓶頸**
**問題：** `/api/chat/rooms` 查詢包含多個 JOIN 和子查詢

**當前查詢：**
- `chatRoomMember.findMany` (JOIN room)
- `chatRoomMember.findMany` (JOIN user) - 查詢所有成員
- 多個 Map 構建操作

**優化方案：**
1. **使用 denormalized 字段**（已在 messages 使用，需擴展到 rooms）
   - 在 `ChatRoom` 表添加 `lastMessageContent`、`lastMessageSenderName`
   - 避免每次查詢都 JOIN `ChatMessage` 表

2. **減少查詢次數**
   - 合併成員查詢為單一查詢
   - 使用原生 SQL 優化 JOIN

3. **增加快取時間**
   - 從 5 秒增加到 10-15 秒（列表更新不頻繁）

**預期提升：** **減少 200-500ms 延遲**

---

### 3. 前端請求去重 ⚡ **立即見效**
**問題：** 從 Network 面板看到多個相同請求同時進行（`messages?limit=10` 重複 5 次）

**解決方案：**
```typescript
// 使用 AbortController 和 Map 追蹤進行中的請求
const inFlightRequests = new Map<string, AbortController>();

async function fetchWithDedup(url: string, key: string) {
  // 如果已有相同請求進行中，取消舊的
  if (inFlightRequests.has(key)) {
    inFlightRequests.get(key)?.abort();
  }
  
  const controller = new AbortController();
  inFlightRequests.set(key, controller);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    inFlightRequests.delete(key);
  }
}
```

**預期提升：** **減少 50% 不必要的請求**

---

### 4. 訊息查詢索引優化
**問題：** 雖然已優化，但可能還有改進空間

**檢查項目：**
- [ ] 確認 `ChatMessage_roomId_createdAt_not_rejected_idx` 索引存在
- [ ] 確認查詢使用索引（使用 `EXPLAIN ANALYZE`）
- [ ] 減少返回的欄位（只返回必要欄位）

**預期提升：** **減少 50-100ms 延遲**

---

## 🟡 中期優化（1-2 天內）

### 5. Redis 快取層級優化
**當前狀態：**
- ✅ 訊息快取：3 秒 TTL
- ✅ 聊天室列表快取：5 秒 TTL
- ❌ 聊天室詳情快取：無

**優化方案：**
1. **增加聊天室詳情快取**
   ```typescript
   // /api/chat/rooms/[roomId]
   const cacheKey = `chat:room:${roomId}`;
   const cached = await Cache.get(cacheKey);
   if (cached) return NextResponse.json({ room: cached });
   ```

2. **增加 meta 快取**（pre-chat 已實作，需擴展到正式聊天）
   ```typescript
   // /api/chat/rooms/[roomId]/meta
   // 只返回 lastMessageAt, unreadCount, isActive
   // TTL: 1 秒
   ```

3. **快取失效策略優化**
   - 發送訊息時，只清除相關快取
   - 使用 pattern delete 批量清除

**預期提升：** **減少 100-200ms 延遲**

---

### 6. 移除舊的 WebSocket 連接
**問題：** 從 Console 看到 WebSocket 連接失敗錯誤

**解決方案：**
- 檢查 `app/chat/page.tsx` 和 `app/chat/[roomId]/page.tsx`
- 移除或註解掉 WebSocket 相關代碼
- 確保只使用 HTTP polling

**預期提升：** **減少錯誤日誌，提升穩定性**

---

### 7. 資料庫連線池優化
**問題：** Vercel serverless 每次請求可能建立新連線

**解決方案：**
- 使用連線池（Prisma 已內建）
- 確保 `DATABASE_URL` 包含連線池參數
- 考慮使用 Supabase 連線池

**預期提升：** **減少 50-100ms 冷啟動延遲**

---

## 🟢 長期優化（1 週內）

### 8. 前端輪詢策略優化
**當前狀態：** 固定 3 秒輪詢

**優化方案：**
1. **智能輪詢間隔**
   - 有新訊息時：1 秒
   - 無新訊息時：5 秒
   - 背景頁面：15 秒

2. **Meta-first 策略**（pre-chat 已實作，需擴展）
   - 先查詢 `/api/chat/rooms/[roomId]/meta`
   - 只有 `lastMessageAt` 改變時才查詢完整訊息

**預期提升：** **減少 70% 不必要的請求**

---

### 9. 資料庫查詢優化
**檢查項目：**
- [ ] 使用 `EXPLAIN ANALYZE` 分析所有慢查詢
- [ ] 添加缺失的索引
- [ ] 優化 JOIN 查詢（考慮 denormalization）

**工具：**
```sql
-- 找出慢查詢
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

### 10. 壓縮和 CDN
**優化方案：**
- 啟用 gzip/brotli 壓縮
- 使用 CDN 快取靜態資源
- 優化圖片大小（已實作 Cloudinary resize）

**預期提升：** **減少 20-30% 傳輸時間**

---

## 📊 效能目標

### 當前狀態（從 Network 面板觀察）
- 聊天室列表載入：**2-8 秒** ❌
- 訊息查詢：**2-9 秒** ❌
- Session 驗證：**50-200ms**（估計）

### 優化後目標
- 聊天室列表載入：**< 500ms** ✅
- 訊息查詢（有快取）：**< 50ms** ✅
- 訊息查詢（無快取）：**< 300ms** ✅
- Session 驗證：**< 1ms**（Redis）✅

---

## 🚀 實作優先級

### 第一階段（立即實作，1-2 小時）
1. ✅ 前端請求去重
2. ✅ 移除 WebSocket 錯誤
3. ✅ 檢查並優化資料庫索引

### 第二階段（今天內，2-4 小時）
4. ✅ Session 驗證優化（Redis）
5. ✅ 聊天室列表 API 優化
6. ✅ 增加更多快取層級

### 第三階段（本週內）
7. ✅ 前端輪詢策略優化
8. ✅ 資料庫查詢深度優化
9. ✅ 壓縮和 CDN

---

## 📝 驗收標準

### 測試方法
1. 開啟 Network 面板
2. 載入聊天室頁面
3. 觀察請求時間

### 成功標準
- [ ] 聊天室列表載入 < 500ms
- [ ] 訊息查詢（快取命中）< 50ms
- [ ] 訊息查詢（快取未命中）< 300ms
- [ ] 無重複請求
- [ ] 無 WebSocket 錯誤
- [ ] 總請求數減少 50%+

---

## 🔧 實作指令（給 Cursor AI）

### 1. 前端請求去重
```typescript
// 在 app/chat/page.tsx 和 app/chat/[roomId]/page.tsx
// 添加請求去重邏輯
```

### 2. Session 優化
```bash
# 參考 docs/SESSION_OPTIMIZATION.md
# 實作 Redis Session Store
```

### 3. 聊天室列表優化
```typescript
// 在 app/api/chat/rooms/route.ts
// 使用 denormalized 字段，減少 JOIN
```

### 4. 移除 WebSocket
```typescript
// 在 app/chat/page.tsx
// 移除或註解 useChatSocket
```

---

## 📈 監控指標

### 需要監控的指標
1. API 響應時間（P50, P95, P99）
2. 資料庫查詢時間
3. Redis 快取命中率
4. 前端請求數量
5. 錯誤率

### 監控工具
- Vercel Analytics
- Supabase Dashboard
- Redis 監控
- 瀏覽器 DevTools

---

## 🎯 總結

**最大瓶頸：**
1. Session 驗證（每次 50-200ms）
2. 聊天室列表查詢（多個 JOIN）
3. 前端重複請求

**最快見效：**
1. 前端請求去重（立即）
2. Session 優化（1-2 小時）
3. 增加快取（30 分鐘）

**預期總體提升：**
- 聊天室載入速度：**提升 80-90%**
- API 響應時間：**減少 70-80%**
- 資料庫負載：**減少 50-60%**

