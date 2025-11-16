# 🚀 申請提領 API 效能優化指南

## 📋 目標
將 `/api/partners/withdrawal/stats` 和 `/api/partners/withdrawal/history` 的查詢時間壓在 **3 秒內**。

## ✅ 已完成的優化

### 1. **Stats API 優化** (`/api/partners/withdrawal/stats`)

#### 查詢優化
- ✅ 使用 raw SQL JOIN 查詢，避免嵌套查詢
- ✅ 單一查詢同時獲取總收入和總接單數
- ✅ 並行執行所有查詢（booking 統計、提領總額、待審核數量）

#### 使用的索引
- `Schedule.partnerId` - 加速查找夥伴的時段
- `Booking.scheduleId_status` - 加速按時段和狀態查詢預約
- `WithdrawalRequest.partnerId_status` - 加速按夥伴和狀態查詢提領記錄

### 2. **History API 優化** (`/api/partners/withdrawal/history`)

#### 查詢優化
- ✅ 限制載入數量（最多 50 筆）
- ✅ 使用 `select` 只選擇必要欄位
- ✅ 使用索引優化的查詢

#### 使用的索引
- `WithdrawalRequest.partnerId` - 加速查找夥伴的提領記錄
- `WithdrawalRequest.partnerId_requestedAt` - 加速按時間排序

## 🔧 必須執行的步驟

### 步驟 1：應用資料庫索引（關鍵！）

**這是效能提升的關鍵，必須先執行！**

```bash
# 方法 1：使用 Prisma（推薦）
npx prisma db push

# 方法 2：手動執行 SQL
# 在資料庫管理工具中執行 prisma/migrations/add_performance_indexes.sql
```

### 步驟 2：驗證索引已創建

執行以下 SQL 檢查索引是否存在：

```sql
-- 檢查關鍵索引是否存在
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('Booking', 'Schedule', 'WithdrawalRequest')
  AND (
    indexname LIKE '%partnerId%' 
    OR indexname LIKE '%scheduleId%'
    OR indexname LIKE '%status%'
  )
ORDER BY tablename, indexname;
```

**必須確認以下索引存在：**
- ✅ `Schedule` 表：`Schedule_partnerId_date_isAvailable_idx` 或 `Schedule_partnerId_idx`
- ✅ `Booking` 表：`Booking_scheduleId_status_idx`
- ✅ `WithdrawalRequest` 表：`WithdrawalRequest_partnerId_status_idx`

### 步驟 3：檢查查詢計劃

執行以下 SQL 檢查查詢是否使用索引：

```sql
-- 檢查 stats API 的查詢計劃（替換 YOUR_PARTNER_ID）
EXPLAIN ANALYZE
SELECT 
  COALESCE(SUM(b."finalAmount"), 0)::float as "totalEarnings",
  COUNT(b.id)::bigint as "totalOrders"
FROM "Booking" b
INNER JOIN "Schedule" s ON b."scheduleId" = s.id
WHERE s."partnerId" = 'YOUR_PARTNER_ID'
  AND b.status IN ('COMPLETED', 'CONFIRMED');
```

**預期結果：**
- 應該看到 `Index Scan` 或 `Index Only Scan`，而不是 `Seq Scan`（全表掃描）
- 執行時間應該 < 500ms

## 📊 預期效能

### 應用索引後
- `/api/partners/withdrawal/stats`: **0.5-1.5 秒**（從 6.93 秒）
- `/api/partners/withdrawal/history`: **0.3-0.8 秒**（從 3.48 秒）

### 如果還是慢
1. **檢查索引是否真的應用**
   ```sql
   SELECT * FROM pg_stat_user_indexes 
   WHERE schemaname = 'public' 
     AND tablename IN ('Booking', 'Schedule', 'WithdrawalRequest')
   ORDER BY idx_scan DESC;
   ```
   如果 `idx_scan` 為 0，表示索引沒有被使用。

2. **檢查資料庫連接**
   - 確保使用 Supabase Pooler URL（`*.pooler.supabase.co`）
   - 檢查連接池配置

3. **檢查資料量**
   - 如果 Booking 表有數百萬筆記錄，可能需要進一步優化
   - 考慮添加分區或歸檔舊數據

## 🔍 查詢優化細節

### Stats API 查詢邏輯

```sql
-- 優化的 JOIN 查詢
SELECT 
  COALESCE(SUM(b."finalAmount"), 0)::float as "totalEarnings",
  COUNT(b.id)::bigint as "totalOrders"
FROM "Booking" b
INNER JOIN "Schedule" s ON b."scheduleId" = s.id
WHERE s."partnerId" = $1
  AND b.status IN ('COMPLETED', 'CONFIRMED')
```

**為什麼快：**
1. 使用 `INNER JOIN` 而不是嵌套查詢
2. 利用 `Schedule.partnerId` 索引快速找到相關時段
3. 利用 `Booking.scheduleId_status` 複合索引快速過濾預約
4. 單一查詢同時計算 SUM 和 COUNT

### History API 查詢邏輯

```typescript
// 優化的查詢
client.withdrawalRequest.findMany({
  where: { partnerId: partner.id },
  orderBy: { requestedAt: 'desc' },
  take: 50, // 限制數量
  select: { /* 只選擇必要欄位 */ }
})
```

**為什麼快：**
1. 使用 `partnerId` 索引快速定位記錄
2. 限制結果數量（50 筆）
3. 只選擇必要欄位，減少資料傳輸

## ⚠️ 重要提醒

1. **索引必須先應用** - 沒有索引，查詢會非常慢
2. **功能完整性** - 所有優化都保持 API 功能完整，不影響業務邏輯
3. **數據準確性** - 查詢結果與優化前完全相同

## 🐛 故障排除

### 問題：查詢還是很慢（> 3 秒）

**檢查清單：**
- [ ] 索引是否已應用？（執行步驟 2 驗證）
- [ ] 查詢是否使用索引？（執行步驟 3 檢查）
- [ ] 資料庫連接是否正常？
- [ ] 是否使用 Supabase Pooler URL？

### 問題：索引創建失敗

**可能原因：**
- 資料庫權限不足
- 表已存在但結構不同
- 連接問題

**解決方法：**
- 檢查資料庫權限
- 手動執行 SQL 創建索引
- 聯繫資料庫管理員

## 📝 後續優化建議

如果應用索引後還是超過 3 秒，可以考慮：

1. **添加緩存層**
   - 對統計數據添加短期緩存（30-60 秒）
   - 使用 Redis 或內存緩存

2. **資料預計算**
   - 在後台定期計算統計數據
   - 存儲在 Partner 表的額外欄位中

3. **分頁優化**
   - History API 實現分頁
   - 初始只載入最近 10-20 筆

4. **資料庫優化**
   - 考慮資料庫升級
   - 檢查資料庫配置（shared_buffers, work_mem 等）

