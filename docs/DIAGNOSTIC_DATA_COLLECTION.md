# 診斷資料收集指南

## 📋 需要收集的資料（按順序）

### 【A】Network Timing 分頁數值 ⚡ **最重要**

**步驟：**
1. 打開聊天室頁面
2. 打開 DevTools → Network 面板
3. 找到一個慢的 `messages` 或 `meta` 請求
4. 點擊該請求
5. 切換到 **"Timing"** 分頁
6. 記錄以下數值：

```
Waiting (TTFB): ? ms
Content Download: ? ms
Total: ? ms
```

**📸 截圖或照抄數值給我**

---

### 【B】API Handler Console Log

**已添加 log：**
- ✅ `app/api/chat/rooms/[roomId]/messages/route.ts`
- ✅ `app/api/chat/rooms/[roomId]/meta/route.ts`

**步驟：**
1. 部署代碼（或本地運行）
2. 打開聊天室頁面
3. 查看 **Vercel Logs**（或本地 console）
   - Vercel: Dashboard → 專案 → Logs
   - 本地: Terminal 或 Console
4. 找到 `[messages] start` 和 `[messages] end` 或 `[meta] start` 和 `[meta] end`
5. 記錄實際耗時

**範例：**
```
[messages] start 1702734000000 roomId: cmxxx
[messages] end 150 ms
```

**📝 貼給我：start 和 end 的時間差**

---

### 【C】DB 直接查詢效能

**在 Supabase SQL Editor 執行：**

```sql
-- 先獲取一個真實的 roomId
SELECT id FROM "ChatRoom" LIMIT 1;

-- 用真實的 roomId 測試（替換 'your-room-id'）
EXPLAIN ANALYZE
SELECT 
  id, "roomId", "senderId", "senderName", "senderAvatarUrl", content, "createdAt"
FROM "ChatMessage"
WHERE "roomId" = '真實的-room-id'  -- 替換為真實的 roomId
  AND "moderationStatus" != 'REJECTED'
ORDER BY "createdAt" DESC, id DESC
LIMIT 10;
```

**記錄：**
- Execution Time: ? ms
- 是否使用 Index Scan 或 Seq Scan
- Planning Time: ? ms

**📝 貼給我：完整的 EXPLAIN ANALYZE 結果（文字即可）**

---

### 【D】DB 供應商和 Region

**從代碼推斷：**
- ✅ **Supabase**（從 `VERCEL_ENV_SETUP.md` 看到 `aws-0-ap-southeast-1.pooler.supabase.com`）
- ✅ **Region: ap-southeast-1**（新加坡）

**確認方法：**
1. 前往 Supabase Dashboard
2. Settings → General
3. 查看 "Region"

**回答格式：**
```
Supabase（ap-southeast-1）
```

---

### 【E】Vercel Runtime

**檢查結果：**
- ✅ `app/api/chat/rooms/[roomId]/messages/route.ts` - **沒有** `export const runtime = 'edge'`
- ✅ `app/api/chat/rooms/[roomId]/meta/route.ts` - **沒有** `export const runtime = 'edge'`

**結論：**
```
nodejs（沒有 export const runtime = 'edge'）
```

---

### 【F】首屏 API 瀑布流

**步驟：**
1. 打開聊天室頁面（首次載入，清除快取）
2. 打開 Network 面板
3. 按時間順序查看請求
4. 找到第一個 `messages` 或 `meta` 請求
5. 數一下它前面有多少個 API 請求

**回答格式：**
```
messages 前面大概還有 X 個 API
前面有：rooms, profile, settings, bookings, ...
```

---

## 🎯 收集完成後

請依序提供：
1. ✅ Network Timing 數值（TTFB, Content Download, Total）
2. ✅ API handler console log（start 和 end 時間差）
3. ✅ EXPLAIN ANALYZE 結果（Execution Time）
4. ✅ DB 供應商 + region（已確認：Supabase ap-southeast-1）
5. ✅ Vercel Runtime（已確認：nodejs）
6. ✅ 首屏 API 瀑布流（messages 前面有幾個 API）

---

## 📊 預期結果分析

### 如果 TTFB > 1s
- **原因：** Server / Cold Start / DB
- **解決：** 優化 server 啟動或使用常駐主機

### 如果 TTFB < 300ms 但畫面慢
- **原因：** 前端 render / waterfall
- **解決：** 優化前端載入順序

### 如果 API log < 100ms 但瀏覽器顯示 2-5s
- **原因：** 平台或網路延遲（Vercel cold start）
- **解決：** 換部署位置或使用 Edge Functions

### 如果 API log > 1s
- **原因：** 程式 / DB 問題
- **解決：** 優化查詢或索引

---

## 🔍 已確認的資訊

### DB 供應商
- **Supabase**（從 `VERCEL_ENV_SETUP.md` 確認）

### DB Region
- **ap-southeast-1**（新加坡，從 `aws-0-ap-southeast-1.pooler.supabase.com` 確認）

### Vercel Runtime
- **nodejs**（沒有使用 edge runtime）

### 潛在問題
- **跨區延遲：** Vercel（可能部署在美國）→ Supabase（新加坡）
- **Cold Start：** Vercel serverless 冷啟動（3-5 秒）
- **連線建立：** 每次請求建立新 DB 連線

---

## ✅ 完成後告訴我

我會根據這些資料：
1. 🔬 定位慢點（只能一個主因）
2. ❌ 告訴你哪些優化是白做的
3. 🔁 告訴你繼續優化 vs 換架構哪個快
4. 🧭 給你最短路徑（最快上線）
