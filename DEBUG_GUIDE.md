# 🔍 快速診斷指南：一眼看出哪裡出錯

## 📍 關鍵檢查點（按優先順序）

### 1. **Vercel 日誌** ⭐ 最重要
**位置：** Vercel Dashboard → 專案 → Logs 標籤

**查看什麼：**
- 找到 `POST /api/bookings` 的錯誤日誌
- **關鍵資訊：**
  - 錯誤訊息（紅色高亮）
  - 錯誤代碼（如 `P2002`, `P2003`, `P2036` 等）
  - 完整的錯誤堆疊追蹤

**範例：**
```
POST 500 /api/bookings
prisma:error Invalid prisma.booking.create() invocation: ...
```

**如何快速找到：**
1. 在 Vercel Logs 中搜尋 `bookings`
2. 點擊紅色錯誤條目
3. 查看完整的錯誤訊息

---

### 2. **瀏覽器 Network 標籤 - Response** ⭐ 第二重要
**位置：** Chrome DevTools → Network → 點擊 `bookings` 請求 → Response 標籤

**查看什麼：**
- API 返回的 JSON 錯誤訊息
- 錯誤代碼和詳細說明

**操作步驟：**
1. 打開 DevTools (F12)
2. 切換到 Network 標籤
3. 點擊失敗的 `bookings` 請求（紅色）
4. 點擊 **Response** 標籤
5. 查看 JSON 響應內容

**範例響應：**
```json
{
  "error": "資料庫操作失敗",
  "code": "P2036",
  "details": "The column partnerId does not exist"
}
```

---

### 3. **瀏覽器 Console 標籤**
**位置：** Chrome DevTools → Console

**查看什麼：**
- JavaScript 錯誤
- 前端錯誤訊息
- API 調用的錯誤

**快速檢查：**
- 紅色錯誤訊息
- 包含 `bookings` 或 `api` 的錯誤

---

### 4. **資料庫結構驗證**
**位置：** Supabase Dashboard → Table Editor → Booking 表

**查看什麼：**
- 確認 `partnerId` 欄位是否存在
- 確認欄位類型是否正確（應為 TEXT）
- 確認欄位是否為 NOT NULL

**快速 SQL 查詢：**
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Booking' AND column_name = 'partnerId';
```

**預期結果：**
```
column_name | data_type | is_nullable
partnerId   | text      | NO
```

---

## 🎯 常見錯誤模式速查表

| 錯誤訊息 | 可能原因 | 解決方法 |
|---------|---------|---------|
| `column partnerId does not exist` | 欄位未添加 | 執行修復 SQL |
| `column partnerId cannot be null` | 有記錄缺少 partnerId | 執行 UPDATE 語句 |
| `foreign key constraint violation` | 外鍵約束問題 | 檢查 Partner 表資料 |
| `P2002` (Unique constraint) | 重複的 scheduleId | 檢查時段是否已被預約 |
| `P2003` (Foreign key) | 關聯資料不存在 | 檢查 customerId/partnerId 是否存在 |
| `P2022` | 值超出範圍或類型不匹配 | 檢查資料值是否符合欄位類型 |
| `P2024` (Timeout) | 資料庫連接超時 | 檢查連接池設定 |

---

## 🚀 快速診斷流程

### 步驟 1：查看 Vercel 日誌（30秒）
```
1. 前往 Vercel Dashboard
2. 選擇 peiplay 專案
3. 點擊 Logs 標籤
4. 搜尋 "bookings"
5. 點擊最新的紅色錯誤
6. 複製完整錯誤訊息
```

### 步驟 2：查看 Network Response（10秒）
```
1. 打開 DevTools (F12)
2. Network 標籤
3. 點擊 bookings 請求
4. Response 標籤
5. 查看 JSON 錯誤訊息
```

### 步驟 3：驗證資料庫（20秒）
```
1. Supabase Dashboard
2. SQL Editor
3. 執行驗證查詢
4. 確認欄位存在
```

---

## 💡 快速修復檢查清單

- [ ] Vercel 日誌顯示的錯誤訊息是什麼？
- [ ] Network Response 中的錯誤代碼是什麼？
- [ ] `partnerId` 欄位是否真的存在於資料庫？
- [ ] 是否有現有記錄缺少 `partnerId` 值？
- [ ] 外鍵約束是否正確設置？

---

## 📝 提供給 AI 的資訊格式

當需要幫助時，請提供：

```
錯誤位置：Vercel 日誌 / Network Response
錯誤訊息：[完整錯誤訊息]
錯誤代碼：[如 P2002, P2003, P2022 等]
錯誤 meta：[如果有，包含欄位資訊]
時間：[發生時間]
```

這樣可以快速定位問題！

---

## 🔍 P2022 錯誤特別說明

**P2022 錯誤**通常表示：
- 值超出欄位允許的範圍
- 資料類型不匹配
- 數值太大或太小

**檢查步驟：**
1. 查看 Vercel 日誌中的完整錯誤訊息
2. 特別注意 `meta` 欄位，會顯示是哪個欄位出問題
3. 檢查 `bookingData` 中的數值是否合理
4. 確認 `originalAmount` 和 `finalAmount` 是否為有效數字

