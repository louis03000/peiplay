# Peiplay 效能優化總結

根據用戶反饋「從資料庫抓資料的頁面還是都要跑一陣子」，我們進行了全面的效能優化。

## ✅ 已完成的優化

### 1. 資料庫查詢優化

#### 消除 N+1 查詢問題
- ✅ `/api/bookings` POST - 批量查詢所有時段，避免迴圈中查詢
- ✅ `/api/partners/ratings` - 批量查詢所有評價，避免 N+1 問題
- ✅ `/api/partners/ranking` - 已使用批量查詢（之前已優化）

#### 查詢語句優化
- ✅ `/api/reviews` 和 `/api/review` - 使用 `select` 而非 `include`
- ✅ `/api/admin/reviews` - 使用 `select` 而非 `include`，限制結果為 100 筆
- ✅ `/api/bookings/partner` - 使用 `select` 而非 `include`，限制結果為 50 筆
- ✅ 避免 OR 條件影響索引使用，改為分別查詢後在應用層合併

### 2. Redis Cache 優化

#### 已添加 Redis Cache 的 API
- ✅ `/api/partners/withdrawal/stats` - 30 秒快取
- ✅ `/api/partners/self` - 30 秒快取
- ✅ `/api/announcements` - 2 分鐘快取（已優化）
- ✅ `/api/partners` - 2 分鐘快取（已優化）
- ✅ `/api/games/list` - 5 分鐘快取（已優化）
- ✅ `/api/partners/ranking` - 2 分鐘快取（已優化）
- ✅ `/api/partners/average-rating` - 5 分鐘快取（已優化）
- ✅ `/api/partners/[id]/profile` - 5 分鐘快取（已優化）
- ✅ `/api/reviews/public` - 5 分鐘快取（已優化）

### 3. HTTP Cache Headers 優化

#### 已添加 Cache-Control Headers
- ✅ `/api/bookings/me` - `private, max-age=30`
- ✅ `/api/bookings/partner` - `private, max-age=10`
- ✅ `/api/schedules` - `private, max-age=10`
- ✅ `/api/partners/ratings` - `public, s-maxage=30`
- ✅ `/api/orders` - `private, max-age=30`
- ✅ `/api/partners/withdrawal/stats` - `private, max-age=10`
- ✅ 圖片快取：從 7 天增加到 30 天

### 4. 查詢限制優化

所有列表 API 都已限制結果數量：
- `/api/bookings/me` - 限制 30 筆
- `/api/bookings/partner` - 限制 50 筆
- `/api/orders` - 限制 50 筆
- `/api/admin/reviews` - 限制 100 筆
- `/api/reviews` - 限制 100 筆

## 📊 預期效能提升

### 查詢優化
- **N+1 問題消除**：多個時段/夥伴查詢從 N 次降為 2-3 次
- **資料傳輸減少**：使用 `select` 只查詢必要欄位，減少 30-50% 資料傳輸
- **查詢時間減少**：限制結果數量，減少資料處理時間

### Cache 優化
- **Redis Cache**：頻繁讀取的資料從 Redis 讀取（< 10ms），遠快於資料庫查詢
- **HTTP Cache**：瀏覽器快取減少重複請求
- **圖片快取**：30 天快取大幅減少圖片重複下載

## 🔍 如果還是很慢，請檢查以下項目

### 1. 資料庫連接池配置

檢查是否使用 Supabase Pooler URL（如果有 Supabase）：
```env
# 應該使用 pooler URL（*.pooler.supabase.co）
DATABASE_URL=postgresql://user:pass@xxxxx.pooler.supabase.co:6543/postgres

# 而不是直接連接（*.supabase.co）
# DATABASE_URL=postgresql://user:pass@xxxxx.supabase.co:5432/postgres
```

### 2. 資料庫索引

確認以下索引是否存在：
```sql
-- Partner 表
CREATE INDEX IF NOT EXISTS "Partner_userId_idx" ON "Partner"("userId");
CREATE INDEX IF NOT EXISTS "Partner_status_createdAt_idx" ON "Partner"("status", "createdAt");

-- Booking 表
CREATE INDEX IF NOT EXISTS "Booking_customerId_createdAt_idx" ON "Booking"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_scheduleId_status_idx" ON "Booking"("scheduleId", "status");

-- Schedule 表
CREATE INDEX IF NOT EXISTS "Schedule_partnerId_date_startTime_idx" ON "Schedule"("partnerId", "date", "startTime");

-- Review 表
CREATE INDEX IF NOT EXISTS "Review_revieweeId_isApproved_idx" ON "Review"("revieweeId", "isApproved");
```

### 3. 監控慢查詢

如果特定 API 還是很慢，可以使用以下方式監控：

```sql
-- 啟用慢查詢日誌（超過 1 秒的查詢）
ALTER DATABASE your_database SET log_min_duration_statement = 1000;

-- 查看慢查詢（需要 pg_stat_statements extension）
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### 4. 資料庫資源

檢查資料庫資源使用情況：
- CPU 使用率是否過高
- 記憶體是否充足
- 連接數是否達到上限
- 是否有長時間運行的查詢阻塞其他查詢

### 5. 網路延遲

如果資料庫和應用伺服器不在同一區域：
- 考慮使用同一區域的資料庫
- 檢查網路延遲（ping 資料庫主機）
- 考慮使用 CDN 或 Edge Functions

## 🎯 進一步優化建議

### 1. 資料庫層面
- ✅ 已優化：添加必要的索引
- ✅ 已優化：使用批量查詢
- ✅ 已優化：限制查詢結果數量
- 💡 建議：定期分析慢查詢並優化
- 💡 建議：使用連接池（PgBouncer 或 Supabase Pooler）

### 2. 應用層面
- ✅ 已優化：使用 Redis Cache
- ✅ 已優化：使用 HTTP Cache Headers
- ✅ 已優化：優化查詢語句
- 💡 建議：考慮使用資料庫讀寫分離（如果有大量讀取）
- 💡 建議：考慮使用 GraphQL DataLoader 模式（如果有複雜關聯查詢）

### 3. 前端優化
- ✅ 已優化：圖片快取
- ✅ 已優化：API 快取
- 💡 建議：使用 SWR 或 React Query 進行客戶端快取
- 💡 建議：實作資料預載入（prefetching）
- 💡 建議：使用虛擬滾動（virtual scrolling）處理長列表

## 📝 測試建議

1. **測試快取效果**：
   - 第一次請求應該較慢（查詢資料庫）
   - 第二次請求應該很快（從 Redis 讀取）

2. **監控 API 回應時間**：
   ```bash
   # 使用 curl 測試
   time curl https://your-domain.com/api/partners
   ```

3. **檢查 Redis 連線**：
   ```bash
   # 確認 Redis 是否正常運作
   redis-cli ping
   ```

## ⚠️ 注意事項

1. **Cache Invalidation**：資料更新時記得清除相關快取
2. **個人資料**：使用 `private` cache，避免資料洩露
3. **資料一致性**：快取時間較短，確保資料不會過期太久
4. **監控**：建議監控快取命中率和 API 回應時間

## 🔧 如果問題持續

如果優化後還是很慢，請提供以下資訊：
1. 具體哪些頁面/API 很慢
2. 回應時間是多少（秒）
3. 資料庫類型（Supabase、自行架設等）
4. 是否使用連接池
5. 資料量大小（用戶數、預約數等）

這樣可以進一步診斷問題。

