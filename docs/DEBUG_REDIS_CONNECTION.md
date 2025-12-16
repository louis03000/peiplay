# 🔍 除錯 Redis 連接問題

## 問題診斷

從 Network 面板看到：
- `X-Cache: MISS` - Cache 沒有命中
- 沒有 `X-Source: kv` header - 表示沒有從 KV 讀取
- 還是很慢（7.20 秒）

## 檢查步驟

### 步驟 1：檢查 Vercel Logs 中的 Redis 訊息

在 Vercel Logs 中搜尋以下關鍵字：

#### ✅ 應該看到的（成功）：
```
✅ Redis connected (external Redis, not in-memory)
```

#### ❌ 不應該看到的（失敗）：
```
⚠️ REDIS_URL not set, cache will be disabled
❌ Redis connection failed
❌ Redis Client Error
```

### 步驟 2：檢查環境變數是否設定

1. 前往 Vercel Dashboard
2. Settings → Environment Variables
3. 確認 `REDIS_URL` 是否存在
4. 確認值是否正確（應該是 `rediss://default:...@...`）

### 步驟 3：檢查 API Logs

在 Vercel Logs 中搜尋：
- `🔥 KV cache HIT` - Cache 命中（成功）
- `❄️ KV cache MISS` - Cache 未命中（正常，第一次請求）
- `⚠️ KV unavailable` - KV 不可用（有問題）

---

## 可能的原因

### 原因 1：環境變數沒有設定
- **檢查：** Vercel Dashboard → Settings → Environment Variables
- **解決：** 確認 `REDIS_URL` 已設定並重新部署

### 原因 2：環境變數格式錯誤
- **檢查：** Redis URL 應該是 `rediss://default:token@host:6379`
- **解決：** 確認格式正確，特別是 `rediss://`（兩個 s）

### 原因 3：Redis 連接失敗
- **檢查：** Vercel Logs 中是否有 `❌ Redis connection failed`
- **解決：** 檢查 Upstash 的 token 是否正確

### 原因 4：第一次請求（正常）
- **說明：** 第一次請求會是 cache miss，第二次應該會快
- **測試：** 重新整理頁面，第二次請求應該 < 200ms

---

## 快速測試

### 測試 1：檢查 Redis 連接
在 Vercel Logs 中搜尋 `Redis`，應該看到：
```
✅ Redis connected (external Redis, not in-memory)
```

### 測試 2：測試 Cache
1. 重新整理聊天室頁面
2. 第一次請求：`X-Cache: MISS`（正常）
3. 第二次請求：`X-Cache: HIT`（應該看到）

### 測試 3：檢查 Response Headers
在 Network 面板中：
- 點擊 `messages?limit=10` 請求
- 查看 Response Headers
- 應該看到 `X-Cache: HIT` 和 `X-Source: kv`（第二次請求後）

---

## 如果還是沒有改善

請告訴我：
1. Vercel Logs 中是否有 `✅ Redis connected` 訊息？
2. Vercel Logs 中是否有 `⚠️ REDIS_URL not set` 訊息？
3. 重新整理頁面後，第二次請求的 `X-Cache` 是什麼？

