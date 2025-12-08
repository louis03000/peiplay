# 📊 索引優化腳本使用指南

## 🚀 快速開始

### 1. 分析現有索引

在 Supabase SQL Editor 中執行：

```sql
-- 執行 scripts/analyze_indexes.sql
```

這會生成以下分析報告：
- 所有表的索引列表
- 索引使用統計
- 未使用的索引
- 重複的索引
- 可合併的索引

### 2. 執行索引優化

**⚠️ 重要：執行前請先備份資料庫！**

在 Supabase SQL Editor 中執行：

```sql
-- 執行 scripts/optimize_indexes.sql
```

這會自動刪除以下不必要的索引：
- `Schedule_partnerId_date_idx`
- `Schedule_partnerId_isAvailable_idx`
- `Booking_scheduleId_idx`
- `GroupBooking_status_idx`
- `GroupBooking_date_startTime_idx`
- `MultiPlayerBooking_customerId_idx`
- `MultiPlayerBooking_status_idx`
- `MultiPlayerBooking_date_startTime_idx`
- `WithdrawalRequest_partnerId_idx`
- `ChatMessage_senderId_moderationStatus_idx`
- `Order_bookingId_createdAt_idx`

### 3. 驗證優化結果

執行以下查詢確認索引已刪除：

```sql
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as "索引大小"
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 📋 腳本說明

### analyze_indexes.sql

**功能：** 分析資料庫中所有索引的使用情況

**輸出：**
1. 所有表的索引列表及大小
2. 索引使用統計（使用次數、讀取行數等）
3. 從未被使用的索引
4. 重複的索引
5. 可合併的索引
6. 每個表的索引總數和總大小

**執行時間：** 約 1-2 分鐘（視資料庫大小而定）

### optimize_indexes.sql

**功能：** 刪除不必要的索引以提升效能

**刪除的索引類型：**
- 重複的索引（被其他索引覆蓋）
- 不必要的單欄位索引（已有複合索引覆蓋）
- 從未被使用的索引（需手動檢查）

**執行時間：** 約 5-10 分鐘（視索引數量而定）

**注意事項：**
- 執行時會鎖定相關表
- 建議在低峰時段執行
- 執行後請監控查詢效能

## 🔍 手動檢查的索引

以下索引可能需要根據實際使用情況決定是否刪除：

```sql
-- 檢查 ChatRoom_lastMessageAt 索引使用情況
SELECT idx_scan FROM pg_stat_user_indexes 
WHERE indexname = 'ChatRoom_lastMessageAt_desc_idx';

-- 檢查 Review_revieweeId 索引使用情況
SELECT idx_scan FROM pg_stat_user_indexes 
WHERE indexname = 'Review_revieweeId_isApproved_createdAt_idx';

-- 檢查 PersonalNotification_isImportant 索引使用情況
SELECT idx_scan FROM pg_stat_user_indexes 
WHERE indexname = 'PersonalNotification_userId_isImportant_createdAt_idx';
```

如果這些索引的使用次數（idx_scan）為 0 或很低，可以考慮刪除：

```sql
DROP INDEX IF EXISTS "ChatRoom_lastMessageAt_desc_idx";
DROP INDEX IF EXISTS "Review_revieweeId_isApproved_createdAt_idx";
DROP INDEX IF EXISTS "PersonalNotification_userId_isImportant_createdAt_idx";
```

## 📈 預期效果

執行優化後，預期可以獲得：

1. **寫入效能提升 10-20%**：減少索引維護開銷
2. **儲存空間節省 5-10%**：刪除不必要的索引
3. **查詢速度提升 5-15%**：減少索引掃描時間
4. **整體效能提升**：減少資料庫負載

## ⚠️ 注意事項

1. **備份資料庫**：執行任何索引操作前，請先備份資料庫
2. **非生產環境測試**：建議先在非生產環境測試
3. **低峰時段執行**：刪除索引會鎖定表，建議在低峰時段執行
4. **監控效能**：執行後監控查詢效能，確保沒有負面影響
5. **逐步執行**：如果擔心影響，可以分批執行，每次刪除幾個索引

## 🆘 故障排除

### 索引刪除失敗

如果索引刪除失敗，可能原因：

1. **索引正在被使用**：等待查詢完成後重試
2. **權限不足**：檢查資料庫權限
3. **索引不存在**：使用 `IF EXISTS` 語句避免錯誤

### 查詢變慢

如果刪除索引後查詢變慢：

1. 檢查查詢是否真的使用了該索引
2. 如果確實需要，可以重新創建索引
3. 使用 `EXPLAIN ANALYZE` 分析查詢計劃

### 重新創建索引

如果需要重新創建已刪除的索引：

```sql
-- 例如：重新創建 Schedule_partnerId_date_idx
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_date_idx" 
ON "Schedule"("partnerId", "date");
```

## 📚 相關文件

- [完整索引優化指南](../docs/INDEX_OPTIMIZATION.md)
- [資料庫速度優化指南](../docs/DATABASE_SPEED_OPTIMIZATION.md)
- [效能優化總結](../docs/PERFORMANCE_OPTIMIZATIONS.md)

