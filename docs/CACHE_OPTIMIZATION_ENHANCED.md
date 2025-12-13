# Peiplay 快取優化增強總結

根據快取最佳實踐和效能優化指南，對 Peiplay 進行了全面的快取優化。

## 📋 優化原則

根據用戶提供的資料，快取優化的核心目標是：
1. **降低使用者端的 Request 發送**
2. **減少 Server Response 回去使用者端資料造成的遲緩和浪費**
3. **避免使用者對資料庫的大量讀寫造成效能耗竭**

## ✅ Client 端快取（瀏覽器快取）

### 1. 靜態資源快取

在 `next.config.js` 中為靜態資源設定了長期快取：

- **Next.js 構建產物** (`/_next/static/*`)
  - `Cache-Control: public, max-age=31536000, immutable`
  - 1 年快取（因為檔案名稱包含內容雜湊，不會變動）

- **Next.js 圖片優化** (`/_next/image/*`)
  - `Cache-Control: public, max-age=31536000, immutable`
  - 1 年快取

- **靜態檔案** (`*.svg`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp`, `*.ico`)
  - `Cache-Control: public, max-age=31536000, immutable`
  - 1 年快取

- **字體檔案** (`*.woff`, `*.woff2`, `*.ttf`, `*.eot`, `*.otf`)
  - `Cache-Control: public, max-age=31536000, immutable`
  - 1 年快取

### 2. 圖片快取優化（重要）

根據用戶提供的資料，**商品圖片應該有更長的快取時間**，以避免首頁上百張商品圖的重複下載：

- **Next.js Image Optimization**
  - `minimumCacheTTL: 2592000`（30 天）
  - 大幅減少圖片重複下載

- **Secure Image API** (`/api/secure-image`)
  - `Cache-Control: public, max-age=2592000, stale-while-revalidate=604800`
  - 30 天快取 + 7 天背景重新驗證
  - 特別適用於首頁多張商品圖的場景

### 3. API 快取策略

#### 公開 API（Public Cache）
這些 API 使用 `public` cache，允許 CDN 和瀏覽器快取：

- `/api/announcements`
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
  - CDN 快取 60 秒，背景重新驗證 300 秒

- `/api/games/list`
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
  - 5 分鐘 CDN 快取

- `/api/partners/ranking`
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
  - 1 分鐘 CDN 快取

- `/api/partners/average-rating`
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
  - 5 分鐘 CDN 快取

- `/api/partners` (GET)
  - `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
  - 1 分鐘 CDN 快取

- `/api/partners/ratings`
  - `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`
  - 30 秒 CDN 快取（變動較頻繁）

- `/api/reviews/public`
  - `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`
  - 5 分鐘 CDN 快取

#### 個人資料 API（Private Cache）
這些 API 使用 `private` cache，只在用戶瀏覽器中快取：

- `/api/favorites`
  - `Cache-Control: private, max-age=60, stale-while-revalidate=120`
  - 1 分鐘瀏覽器快取

- `/api/personal-notifications`
  - `Cache-Control: private, max-age=30, stale-while-revalidate=60`
  - 30 秒瀏覽器快取

- `/api/bookings/me`
  - `Cache-Control: private, max-age=30, stale-while-revalidate=60`
  - 30 秒瀏覽器快取

- `/api/orders`
  - `Cache-Control: private, max-age=30, stale-while-revalidate=60`
  - 30 秒瀏覽器快取

- `/api/schedules` (GET)
  - `Cache-Control: private, max-age=10, stale-while-revalidate=30`
  - 10 秒瀏覽器快取（變動頻繁）

- `/api/partners/self`
  - `Cache-Control: private, max-age=60, stale-while-revalidate=120`
  - 1 分鐘瀏覽器快取

### 4. Stale-While-Revalidate (SWR) 策略

所有快取的 API 都使用了 SWR 策略，讓使用者可以：
- 立即看到快取的資料（即使是舊的）
- 背景自動更新資料（stale-while-revalidate）
- 下次訪問時使用新資料

這大幅提升了使用者體驗，特別是在網路較慢的情況下。

## ✅ Server 端快取（Redis Cache）

### Redis 快取策略

使用 Redis 作為應用層快取，避免頻繁查詢資料庫：

**已實施 Redis 快取的 API：**
- `/api/announcements` - 2 分鐘快取
- `/api/partners` - 2 分鐘快取
- `/api/games/list` - 5 分鐘快取
- `/api/partners/ranking` - 2 分鐘快取
- `/api/partners/average-rating` - 5 分鐘快取
- `/api/partners/[id]/profile` - 5 分鐘快取
- `/api/reviews/public` - 5 分鐘快取

**快取 TTL 策略：**
- `SHORT` (60秒): 高頻變動資料
- `MEDIUM` (300秒/5分鐘): 一般資料
- `LONG` (1800秒/30分鐘): 較少變動資料
- `VERY_LONG` (3600秒/1小時): 靜態資料

### Cache Invalidation 策略

實作了自動快取失效機制：
- 當 Partner 更新時，清除相關快取
- 當 Booking 更新時，清除相關快取
- 當 Review 新增時，清除相關快取
- 當 KYC 狀態變更時，清除相關快取

## 📊 效能提升預期

### Client 端快取
- **圖片下載次數減少**：30 天快取，大幅減少重複下載
- **首頁載入速度**：100 張商品圖只需第一次下載，之後從瀏覽器快取讀取
- **API 請求減少**：SWR 策略讓背景更新不影響使用者體驗

### Server 端快取
- **資料庫查詢減少**：頻繁讀取的資料從 Redis 快取，不查詢資料庫
- **回應時間提升**：Redis 快取回應時間 < 10ms，遠快於資料庫查詢
- **伺服器負載降低**：減少資料庫 I/O，提升整體系統效能

## 🔧 Cache-Control Header 說明

### Public vs Private
- **`public`**: 允許 CDN 和瀏覽器快取（用於公開資料）
- **`private`**: 只在瀏覽器快取（用於個人資料）

### max-age vs s-maxage
- **`max-age`**: 瀏覽器快取時間（秒）
- **`s-maxage`**: CDN/Proxy 快取時間（秒），覆蓋 `max-age`

### stale-while-revalidate
- 允許在快取過期後，仍可提供舊資料
- 同時在背景更新資料，下次使用新資料
- 大幅提升使用者體驗，避免等待資料更新

### immutable
- 表示資源永遠不會變動
- 瀏覽器可以永久快取，不需要重新驗證
- 適用於包含內容雜湊的檔案（如 `_next/static`）

## ⚠️ 注意事項

1. **快取失效**：重要資料更新時，記得清除相關快取
2. **個人資料**：使用 `private` cache，避免資料洩露
3. **動態資料**：變動頻繁的資料使用較短的快取時間
4. **圖片快取**：30 天快取適合不常變動的商品圖片，如需更新請使用新的 URL

## 📈 監控建議

建議監控以下指標：
- Cache Hit Rate（快取命中率）
- API 回應時間（快取 vs 非快取）
- 資料庫查詢次數（應該減少）
- 頻寬使用量（應該減少）

