# ✅ 驗證 Redis 是否工作

## 問題

兩次請求都是 `X-Cache: MISS`，表示 Redis cache 沒有工作。

## 檢查步驟

### 步驟 1：確認已部署修復後的代碼

檢查 Vercel 最新的部署時間：
- 如果是在修復代碼之前部署的，需要重新部署
- 修復時間：剛才（添加了 `client.isReady` 檢查）

### 步驟 2：在 Vercel Logs 中搜尋

在 Vercel Logs 的搜尋框輸入以下關鍵字：

#### 搜尋 1：檢查 Redis 連接
```
Redis connected
```
或
```
REDIS_URL not set
```

#### 搜尋 2：檢查 Cache 操作
```
KV cache
```
或
```
Cache get error
```

#### 搜尋 3：檢查是否有錯誤
```
Redis Client Error
```
或
```
Redis connection failed
```

### 步驟 3：查看具體的錯誤訊息

如果看到：
- `⚠️ REDIS_URL not set` → 環境變數沒有設定
- `❌ Redis connection failed` → Redis 連接失敗
- `❌ Cache get error` → Cache 操作失敗

---

## 快速測試方法

### 測試 1：檢查環境變數

1. 前往 Vercel Dashboard
2. Settings → Environment Variables
3. 確認 `REDIS_URL` 存在且值正確

### 測試 2：強制觸發 Redis 連接

在 Vercel Logs 中搜尋：
```
isReady
```

如果看到 `isReady` 相關的錯誤，表示 Redis client 連接有問題。

### 測試 3：查看 API Logs

在 Vercel Logs 中搜尋：
```
messages?limit=10
```

查看該請求的完整 logs，應該會看到：
- `❄️ KV cache MISS` - 第一次請求（正常）
- `✅ KV cache set` - 寫入 cache（應該看到）
- `🔥 KV cache HIT` - 第二次請求（應該看到）

---

## 如果還是 `X-Cache: MISS`

請告訴我：
1. Vercel Logs 中是否有 `⚠️ REDIS_URL not set` 訊息？
2. Vercel Logs 中是否有 `❌ Redis connection failed` 訊息？
3. Vercel Logs 中是否有 `❌ Cache get error` 訊息？

這樣我就能判斷問題出在哪裡。

