# Peiplay 效能診斷指南

根據您提供的資料，網頁從資料庫抓資料時「跑一陣子」是正常的，但需要判斷是否異常。本指南提供診斷方法和優化總結。

## 📊 正常 vs 異常的判斷標準

### 正常情況
- **首次請求**：1-3 秒（需要查詢資料庫、處理資料）
- **快取命中**：< 500ms（從 Redis 或瀏覽器快取讀取）
- **簡單查詢**：< 1 秒（單表查詢、有索引）
- **複雜查詢**：1-3 秒（多表 JOIN、聚合函數）

### 異常情況（需要優化）
- **每次都超過 5 秒**：可能有效能問題
- **簡單頁面也很慢**：可能是資料庫連接或索引問題
- **時間不穩定**：可能是有慢查詢阻塞或其他問題
- **特定時間特別慢**：可能是尖峰時段負載問題

## ✅ 已完成的優化

### 1. 資料庫查詢優化

#### 消除 N+1 查詢問題
- ✅ `/api/bookings` POST - 批量查詢所有時段
- ✅ `/api/partners/ratings` - 批量查詢所有評價
- ✅ `/api/partners/ranking` - 批量查詢所有評價

#### 查詢語句優化
- ✅ 使用 `select` 而非 `include`（只查詢必要欄位）
- ✅ 避免 OR 條件（改用分別查詢後在應用層合併）
- ✅ 所有列表 API 都限制結果數量（30-100 筆）
- ✅ 使用索引優化的排序欄位

#### 分頁優化
- ✅ 多個 API 支援 cursor-based pagination（避免大偏移量問題）
  - `/api/messages`
  - `/api/notifications`
  - `/api/admin/chat`
  - `/api/admin/security-reports`

### 2. 快取優化

#### Redis Cache（Server 端）
已為以下 API 添加 Redis Cache：
- `/api/announcements` - 2 分鐘
- `/api/partners` - 2 分鐘
- `/api/games/list` - 5 分鐘
- `/api/partners/ranking` - 2 分鐘
- `/api/partners/average-rating` - 5 分鐘
- `/api/partners/[id]/profile` - 5 分鐘
- `/api/reviews/public` - 5 分鐘
- `/api/partners/withdrawal/stats` - 30 秒
- `/api/partners/self` - 30 秒

#### HTTP Cache（Client 端）
- ✅ 靜態資源：1 年快取（immutable）
- ✅ 圖片：30 天快取
- ✅ 公開 API：60-300 秒 CDN 快取
- ✅ 個人資料 API：10-60 秒瀏覽器快取

### 3. 查詢限制

所有列表 API 都已限制結果數量：
- `/api/bookings/me` - 30 筆
- `/api/bookings/partner` - 50 筆
- `/api/orders` - 50 筆
- `/api/admin/reviews` - 100 筆
- `/api/reviews` - 100 筆
- `/api/partners` - 50 筆
- `/api/partner/dashboard` - 100 筆時段

## 🔍 效能診斷方法

### 1. 監控 API 回應時間

#### 使用瀏覽器開發工具
1. 開啟 Chrome DevTools（F12）
2. 切換到 Network 標籤
3. 重新載入頁面
4. 查看各 API 的 `Time` 欄位

**判斷標準：**
- < 500ms：優秀
- 500ms - 1s：良好
- 1s - 3s：可接受（首次請求）
- > 3s：需要優化

#### 使用 curl 測試
```bash
# 測試 API 回應時間
time curl -H "Cookie: your-session-cookie" \
  https://your-domain.com/api/partners

# 測試快取效果（第二次應該更快）
time curl -H "Cookie: your-session-cookie" \
  https://your-domain.com/api/partners
```

### 2. 檢查資料庫慢查詢

#### 啟用慢查詢日誌
```sql
-- 在 PostgreSQL 中啟用慢查詢日誌
ALTER DATABASE your_database SET log_min_duration_statement = 1000;

-- 查看慢查詢（需要 pg_stat_statements extension）
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- 超過 1 秒的查詢
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### 使用 Peiplay 內建的慢查詢監控
訪問：`/api/admin/slow-queries?type=slowest&limit=20`

需要管理員權限，會顯示：
- 最慢的查詢
- 最常執行的查詢
- 總執行時間最長的查詢
- 當前正在執行的慢查詢
- 全表掃描統計

### 3. 檢查索引使用情況

#### 查看缺少索引的表
```sql
-- 查看全表掃描最多的表
SELECT 
  schemaname,
  relname AS table_name,
  seq_scan AS sequential_scans,
  idx_scan AS index_scans,
  CASE 
    WHEN seq_scan + idx_scan > 0 
    THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 2)
    ELSE 0 
  END AS seq_scan_percent
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC
LIMIT 20;
```

**判斷標準：**
- `seq_scan_percent > 10%`：可能需要添加索引

### 4. 檢查資料庫連接

#### 查看當前連接數
```sql
-- 查看當前連接數和狀態
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();
```

#### 檢查連接池配置
確認是否使用連接池：
- Supabase：應該使用 `*.pooler.supabase.co:6543`
- 自行架設：建議使用 PgBouncer

### 5. 監控快取命中率

#### Redis Cache 命中率
可以透過 Redis CLI 查看：
```bash
redis-cli INFO stats
# 查看 keyspace_hits 和 keyspace_misses
```

**計算命中率：**
```
命中率 = keyspace_hits / (keyspace_hits + keyspace_misses)
```

**判斷標準：**
- > 80%：優秀
- 60-80%：良好
- < 60%：需要檢查快取策略

## 🎯 常見問題診斷

### 問題 1：特定頁面很慢

**症狀：** 只有某個頁面很慢，其他頁面正常

**診斷步驟：**
1. 檢查該頁面使用的 API
2. 查看 Network 標籤，找出慢的 API
3. 檢查該 API 是否有：
   - 複雜的 JOIN
   - 大量的資料處理
   - 缺少索引的查詢
   - 沒有快取

**解決方案：**
- 添加 Redis Cache
- 優化查詢語句
- 添加必要的索引
- 限制結果數量

### 問題 2：首次載入很慢，之後很快

**症狀：** 第一次訪問很慢（3-5秒），之後很快（< 1秒）

**診斷：**
這是**正常現象**，表示快取運作正常。

**優化建議：**
- 首次載入時間可以透過預熱快取改善
- 考慮使用 SSR 或 SSG 預先渲染
- 使用 CDN 加速靜態資源

### 問題 3：所有頁面都很慢

**症狀：** 無論哪個頁面都很慢

**可能原因：**
1. 資料庫連接問題（網路延遲、連接池耗盡）
2. 資料庫資源不足（CPU、記憶體）
3. 資料庫沒有使用連接池

**診斷步驟：**
1. 檢查資料庫連接時間
2. 檢查資料庫 CPU/記憶體使用率
3. 確認是否使用連接池
4. 檢查是否有長時間運行的查詢阻塞

**解決方案：**
- 使用連接池（PgBouncer 或 Supabase Pooler）
- 升級資料庫資源
- 檢查並優化慢查詢

### 問題 4：特定時間特別慢

**症狀：** 某些時段（如尖峰時段）特別慢

**可能原因：**
1. 同時請求過多
2. 資料庫連接數達到上限
3. 伺服器資源不足

**解決方案：**
- 增加快取時間（減少資料庫查詢）
- 使用負載平衡
- 升級伺服器資源
- 考慮讀寫分離

## 📈 效能監控建議

### 1. 設置效能監控

#### API 回應時間監控
可以在每個 API 中添加效能監控：

```typescript
const startTime = performance.now();
// ... API 邏輯 ...
const duration = performance.now() - startTime;

// 記錄慢查詢（> 1秒）
if (duration > 1000) {
  console.warn(`⏱️ Slow API: ${routePath} took ${duration}ms`);
}
```

#### 資料庫查詢時間監控
Prisma 已經有查詢日誌（在開發環境），可以：
- 查看 `console.log` 中的查詢時間
- 使用 `pg_stat_statements` 分析慢查詢

### 2. 定期檢查

建議每週檢查一次：
- 慢查詢報告
- 索引使用情況
- 快取命中率
- 資料庫連接數

## 🔧 進一步優化建議

### 1. 資料庫層面

#### 索引優化
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

#### 使用連接池
- Supabase：使用 Pooler URL（`*.pooler.supabase.co:6543`）
- 自行架設：使用 PgBouncer

### 2. 應用層面

#### 預熱快取
可以創建一個 cron job 定期預熱常用資料的快取：
```typescript
// 預熱常用 API 的快取
async function warmupCache() {
  await fetch('/api/partners'); // 觸發快取
  await fetch('/api/announcements');
  await fetch('/api/games/list');
}
```

#### 資料預載入（Prefetching）
在前端使用 SWR 或 React Query 進行資料預載入：
```typescript
import useSWR from 'swr';

// 自動重新驗證和預載入
const { data } = useSWR('/api/partners', fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 120000, // 每 2 分鐘重新驗證
});
```

### 3. 前端優化

#### 虛擬滾動（Virtual Scrolling）
對於長列表，使用虛擬滾動只渲染可見項目：
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

// 只渲染可見的項目，大幅減少 DOM 節點
```

#### 延遲載入（Lazy Loading）
對於非關鍵資料，使用延遲載入：
```typescript
// 使用 React.lazy 和 Suspense
const PartnerList = React.lazy(() => import('./PartnerList'));
```

#### 分頁載入
前端實作分頁，每次只載入一頁資料：
```typescript
const [page, setPage] = useState(1);
const { data } = useSWR(`/api/partners?page=${page}&limit=20`);
```

## 📊 效能基準測試

### 預期效能指標

| API | 首次請求 | 快取命中 | 狀態 |
|-----|---------|---------|------|
| `/api/partners` | 1-2s | < 100ms | ✅ 已優化 |
| `/api/bookings/me` | 0.5-1s | < 50ms | ✅ 已優化 |
| `/api/announcements` | 0.5-1s | < 50ms | ✅ 已優化 |
| `/api/partners/ranking` | 2-3s | < 100ms | ✅ 已優化 |
| `/api/partners/withdrawal/stats` | 1-2s | < 50ms | ✅ 已優化 |

### 測試方法

```bash
# 測試 API 效能
for i in {1..5}; do
  echo "Test $i:"
  time curl -H "Cookie: session=..." \
    https://your-domain.com/api/partners
  sleep 2
done
```

**預期結果：**
- 第一次：較慢（1-3秒）
- 之後幾次：很快（< 500ms）

## 🎯 總結

### 已完成的優化
- ✅ 消除 N+1 查詢問題
- ✅ 優化查詢語句（select 而非 include）
- ✅ 添加 Redis Cache
- ✅ 添加 HTTP Cache Headers
- ✅ 限制查詢結果數量
- ✅ 實作 cursor-based pagination

### 判斷效能是否正常
1. **首次請求 1-3 秒**：正常
2. **快取命中 < 500ms**：正常
3. **每次都超過 5 秒**：異常，需要檢查
4. **時間不穩定**：可能有慢查詢或連接問題

### 如果還是很慢
1. 檢查是否使用連接池（Supabase Pooler）
2. 檢查資料庫索引是否足夠
3. 使用慢查詢監控找出問題查詢
4. 檢查資料庫資源使用情況
5. 考慮升級資料庫資源

## 📞 需要幫助時提供的信息

如果優化後還是很慢，請提供：
1. 具體哪些 API/頁面很慢
2. 回應時間是多少（秒）
3. 是首次請求還是快取命中後
4. 資料庫類型（Supabase、自行架設等）
5. 是否使用連接池
6. 資料量大小（用戶數、預約數等）

這樣可以進一步診斷問題。

