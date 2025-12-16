# 🔍 如何在 Vercel Logs 中找到 Redis 訊息

## 問題

在 Vercel Logs 中找不到 Redis 相關訊息。

## 原因

Redis 連接訊息可能：
1. 只在 serverless function **第一次啟動時**顯示（cold start）
2. 不會在每次請求都顯示
3. 可能被其他 logs 淹沒

## 搜尋方法

### 方法 1：在 Logs 中搜尋關鍵字

在 Vercel Logs 的搜尋框（右上角 "Q 73 total logs found..."）中輸入：

#### 搜尋關鍵字：
```
Redis
```

或

```
REDIS_URL
```

或

```
KV cache
```

### 方法 2：查看所有 Logs（不要過濾）

1. 在左側的 "Contains Console Level" 區塊
2. **取消勾選所有過濾器**（Warning, Error, Fatal）
3. 這樣可以看到所有 logs，包括 info 級別的訊息

### 方法 3：查看部署時的 Logs

Redis 連接訊息通常在 **部署時** 或 **第一次請求時** 顯示：

1. 前往 **Deployments** tab
2. 選擇最新的部署
3. 點擊 **Logs**
4. 搜尋 `Redis`

---

## 如果還是找不到

### 可能的原因 1：Redis 沒有連接成功

如果 Redis 連接失敗，可能不會顯示任何訊息（因為錯誤被 catch 了）。

### 可能的原因 2：環境變數沒有生效

即使設定了環境變數，如果沒有重新部署，也不會生效。

### 可能的原因 3：Redis 連接是異步的

Redis 連接是異步的，可能在 logs 中看不到。

---

## 更好的驗證方法

### 方法 1：測試 API 並查看 Response Headers

1. 打開聊天室頁面
2. 打開 Chrome DevTools → Network
3. 重新整理頁面
4. 找到 `messages?limit=10` 請求
5. 查看 Response Headers：
   - 第一次請求：`X-Cache: MISS`（正常）
   - 第二次請求：`X-Cache: HIT`（表示 cache 生效）

### 方法 2：查看 Server Logs 中的 Cache 訊息

在 Vercel Logs 中搜尋：
```
KV cache HIT
```

或

```
KV cache MISS
```

如果看到這些訊息，表示 Redis 有在工作。

### 方法 3：強制觸發 Redis 連接

我們可以添加一個測試 API 來強制觸發 Redis 連接，這樣就能在 logs 中看到訊息。

---

## 快速測試

### 測試 1：檢查環境變數是否生效

在 Vercel Logs 中搜尋：
```
REDIS_URL
```

如果看到 `⚠️ REDIS_URL not set`，表示環境變數沒有設定。

### 測試 2：檢查 Cache 是否工作

1. 重新整理聊天室頁面
2. 第一次請求：查看 Network → `messages?limit=10` → Response Headers → `X-Cache: MISS`
3. 第二次請求：應該看到 `X-Cache: HIT`

如果第二次請求還是 `X-Cache: MISS`，表示 Redis 沒有工作。

---

## 如果還是找不到 Redis 訊息

請告訴我：
1. 在 Vercel Logs 中搜尋 `KV cache`，有看到什麼嗎？
2. 重新整理頁面後，第二次請求的 `X-Cache` 是什麼？（在 Network 面板查看）

這樣我就能判斷 Redis 是否真的在工作。

