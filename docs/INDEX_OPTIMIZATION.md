# 📊 Peiplay 資料庫索引優化指南

## 📋 概述

本文件說明 Peiplay 資料庫索引優化的完整過程，包括如何分析、優化和維護索引以提升資料庫效能。

## 🎯 優化目標

1. **刪除不必要的索引**：減少寫入時的索引維護開銷
2. **合併重複索引**：避免索引重複，節省儲存空間
3. **保留必要索引**：確保查詢效能不受影響
4. **提升整體效能**：減少索引掃描時間，加快查詢速度

## 🔍 索引分析

### 步驟 1：執行索引分析腳本

在 Supabase SQL Editor 中執行 `scripts/analyze_indexes.sql`，該腳本會：

1. 列出所有表的索引及其大小
2. 檢查索引使用統計（使用次數、讀取行數等）
3. 識別從未被使用的索引（idx_scan = 0）
4. 找出重複的索引
5. 檢查可以合併的索引
6. 統計每個表的索引總數和總大小

### 步驟 2：分析結果

根據分析結果，識別以下類型的索引：

- **未使用的索引**：idx_scan = 0 且不是主鍵或唯一約束
- **重複索引**：相同欄位組合的多個索引
- **可合併索引**：一個索引是另一個的前綴
- **低效索引**：使用率低但佔用大量空間的索引

## 🛠️ 索引優化

### 步驟 1：執行優化腳本

在 Supabase SQL Editor 中執行 `scripts/optimize_indexes.sql`，該腳本會：

1. 刪除重複的索引
2. 刪除不必要的單欄位索引（如果已有複合索引覆蓋）
3. 刪除從未被使用的索引
4. 保留所有必要的索引

### 步驟 2：驗證優化結果

執行以下查詢確認索引已正確刪除：

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 步驟 3：檢查索引使用情況

執行以下查詢查看索引使用統計：

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "使用次數",
    pg_size_pretty(pg_relation_size(indexrelid)) as "索引大小"
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, tablename, indexname;
```

## 📝 已優化的索引

### Schedule 表

**刪除的索引：**
- `Schedule_partnerId_date_idx` - 被 `Schedule_partnerId_date_isAvailable_idx` 覆蓋
- `Schedule_partnerId_isAvailable_idx` - 不常見的查詢模式

**保留的索引：**
- `Schedule_partnerId_date_isAvailable_idx` - 最完整的複合索引
- `Schedule_date_isAvailable_idx` - 按日期查詢可用時段
- `Schedule_partnerId_startTime_isAvailable_idx` - 夥伴詳情頁查詢

### Booking 表

**刪除的索引：**
- `Booking_scheduleId_idx` - scheduleId 是 unique，已有唯一索引，且已有 `scheduleId + status` 索引

**保留的索引：**
- `Booking_status_idx` - 按狀態查詢
- `Booking_customerId_status_idx` - 客戶特定狀態查詢
- `Booking_scheduleId_status_idx` - 判斷時段是否有活躍預約
- `Booking_customerId_createdAt_idx` - 客戶預約列表
- `Booking_status_createdAt_desc_idx` - 管理員查詢
- `Booking_customerId_createdAt_desc_idx` - 客戶預約列表（降序）

### GroupBooking 表

**刪除的索引：**
- `GroupBooking_status_idx` - 被 `GroupBooking_status_date_startTime_idx` 覆蓋
- `GroupBooking_date_startTime_idx` - 被 `GroupBooking_status_date_startTime_idx` 覆蓋

**保留的索引：**
- `GroupBooking_status_date_startTime_idx` - 最完整的複合索引

### MultiPlayerBooking 表

**刪除的索引：**
- `MultiPlayerBooking_customerId_idx` - 被 `MultiPlayerBooking_customerId_status_createdAt_idx` 覆蓋
- `MultiPlayerBooking_status_idx` - 被 `MultiPlayerBooking_customerId_status_createdAt_idx` 覆蓋
- `MultiPlayerBooking_date_startTime_idx` - 被 `MultiPlayerBooking_customerId_status_createdAt_idx` 覆蓋

**保留的索引：**
- `MultiPlayerBooking_customerId_status_createdAt_idx` - 最完整的複合索引

### WithdrawalRequest 表

**刪除的索引：**
- `WithdrawalRequest_partnerId_idx` - 被其他兩個索引覆蓋

**保留的索引：**
- `WithdrawalRequest_partnerId_status_idx` - 最常用
- `WithdrawalRequest_partnerId_requestedAt_idx` - 按時間排序

### ChatMessage 表

**刪除的索引：**
- `ChatMessage_senderId_moderationStatus_idx` - 不常見的查詢模式

**保留的索引：**
- `ChatMessage_roomId_createdAt_idx` - 基本查詢
- `ChatMessage_roomId_moderationStatus_createdAt_idx` - 未讀訊息
- `ChatMessage_senderId_idx` - 發送者查詢

### Order 表

**刪除的索引：**
- `Order_bookingId_createdAt_idx` - bookingId 通常通過 Booking 關聯查詢

**保留的索引：**
- `Order_customerId_createdAt_desc_idx` - 客戶訂單列表

## ⚠️ 注意事項

### 執行前準備

1. **備份資料庫**：執行任何索引操作前，請先備份資料庫
2. **非生產環境測試**：建議先在非生產環境測試
3. **低峰時段執行**：刪除索引會鎖定表，建議在低峰時段執行
4. **監控效能**：執行後監控查詢效能，確保沒有負面影響

### 需要手動檢查的索引

以下索引可能需要根據實際使用情況決定是否刪除：

- `ChatRoom_lastMessageAt_desc_idx` - 如果聊天室列表不常按最後訊息時間排序
- `Review_revieweeId_isApproved_createdAt_idx` - 如果使用率低
- `PersonalNotification_userId_isImportant_createdAt_idx` - 如果使用率低
- `SecurityLog_ipAddress_timestamp_idx` - 如果 ipAddress 查詢不常見

### 索引維護

1. **定期檢查**：建議每季度執行一次索引分析
2. **監控使用情況**：定期檢查索引使用統計
3. **根據查詢模式調整**：隨著應用發展，查詢模式可能改變，需要相應調整索引

## 📈 預期效果

執行索引優化後，預期可以獲得以下效果：

1. **寫入效能提升**：減少索引維護開銷，提升 INSERT/UPDATE 速度
2. **儲存空間節省**：刪除不必要的索引，節省儲存空間
3. **查詢速度提升**：減少索引掃描時間，加快查詢速度
4. **整體效能提升**：減少資料庫負載，提升整體應用效能

## 🔄 後續維護

### 定期檢查清單

- [ ] 每季度執行一次索引分析
- [ ] 檢查未使用的索引
- [ ] 檢查重複的索引
- [ ] 根據新的查詢模式調整索引
- [ ] 監控查詢效能變化

### 新增索引原則

在新增索引前，請考慮：

1. **查詢頻率**：該查詢是否經常執行？
2. **查詢模式**：是否有多個查詢使用相同的欄位組合？
3. **索引大小**：索引大小是否合理？
4. **寫入頻率**：表是否經常寫入？索引會影響寫入效能

## 📚 相關文件

- [資料庫速度優化指南](./DATABASE_SPEED_OPTIMIZATION.md)
- [效能優化總結](./PERFORMANCE_OPTIMIZATIONS.md)
- [Prisma Schema](../prisma/schema.prisma)

## 🆘 故障排除

### 問題：刪除索引後查詢變慢

**解決方法：**
1. 檢查查詢是否真的使用了該索引
2. 如果確實需要，可以重新創建索引
3. 考慮使用 EXPLAIN ANALYZE 分析查詢計劃

### 問題：索引刪除失敗

**可能原因：**
- 索引正在被使用
- 權限不足
- 索引不存在

**解決方法：**
1. 檢查索引是否存在
2. 檢查資料庫權限
3. 在低峰時段重試

### 問題：查詢計劃未使用索引

**可能原因：**
- 資料量太小，全表掃描更快
- 索引統計資訊過時
- 查詢條件與索引不匹配

**解決方法：**
```sql
-- 更新統計資訊
ANALYZE;

-- 強制使用索引（僅用於測試）
SET enable_seqscan = off;
```

