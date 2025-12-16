# Upstash Redis URL 設定步驟

## 📍 從 Upstash 獲取 Redis URL

### 步驟 1：切換到 TCP Tab

在 Upstash 的 "Connect" 區塊：
1. 找到 "REST" 和 "TCP" 兩個 tab
2. **點擊 "TCP" tab**（目前你看到的是 REST）

### 步驟 2：複製 Redis URL

切換到 TCP tab 後，你會看到：

**Redis URL 格式：**
```
rediss://default:[token]@harmless-llama-5233.upstash.io:6379
```

**需要複製的資訊：**
1. 找到 "Token" 或 "Password"
   - 點擊眼睛圖示顯示完整 token
   - 複製完整 token

2. 組合完整的 Redis URL：
   ```
   rediss://default:[貼上你的token]@harmless-llama-5233.upstash.io:6379
   ```

**範例：**
如果 token 是 `AXXX123456789`，完整的 URL 就是：
```
rediss://default:AXXX123456789@harmless-llama-5233.upstash.io:6379
```

---

## ⚠️ 重要提醒

- ✅ 使用 `rediss://`（兩個 s，表示 SSL/TLS）
- ✅ 用戶名是 `default`（固定）
- ✅ Token 要完整複製，不要遺漏
- ❌ 不要使用 REST URL（那是給 REST API 用的）

---

## 📝 在 Vercel 設定

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇 `peiplay` 專案
3. Settings → Environment Variables
4. 添加：
   - **Name**: `REDIS_URL`
   - **Value**: 貼上完整的 Redis URL（從 TCP tab 複製的）
   - **Environment**: Production, Preview, Development（全部選擇）

5. 重新部署（必須！）

---

## ✅ 驗證

部署後，檢查 Vercel Logs：
- 應該看到：`✅ Redis connected (external Redis, not in-memory)`
- 不應該看到：`⚠️ REDIS_URL not set, cache will be disabled`

然後測試聊天室：
- Network 面板：`messages?limit=10` 應該 < 200ms（第二次請求後）
- Response headers：應該有 `X-Cache: HIT`

