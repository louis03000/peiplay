# ⚠️ Redis 設定必須完成

## 問題

從 Network 面板看到 `messages?limit=10` 還是很慢（7.99秒），這表示 **KV cache 沒有生效**。

## 原因

**`REDIS_URL` 環境變數沒有設定**，導致：
- Cache.get() 返回 null（Redis 不可用）
- Cache.set() 失敗（Redis 不可用）
- 所有查詢都直接走 DB（沒有 cache）

## 解決方案

### 步驟 1：設定 REDIS_URL

#### 選項 A：使用 Upstash Redis（推薦）

1. 前往 [Upstash Console](https://console.upstash.com/)
2. 建立 Redis 資料庫
3. 複製 Redis URL（格式：`rediss://default:token@redis-xxx.upstash.io:6379`）

#### 選項 B：使用 Vercel KV

如果已經有 Vercel KV，使用對應的連接字串。

### 步驟 2：在 Vercel 設定環境變數

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇 `peiplay` 專案
3. Settings → Environment Variables
4. 添加：
   - **Name**: `REDIS_URL`
   - **Value**: 你的 Redis URL（從 Upstash 或 Vercel KV 複製）
   - **Environment**: Production, Preview, Development（全部）

### 步驟 3：重新部署

設定環境變數後，**必須重新部署**才能生效：
- 在 Vercel Dashboard 點擊 "Redeploy"
- 或 push 一個新的 commit

### 步驟 4：驗證

部署後，檢查 Vercel Logs：
- 應該看到：`✅ Redis connected (external Redis, not in-memory)`
- 不應該看到：`⚠️ REDIS_URL not set, cache will be disabled`

然後測試聊天室：
- Network 面板：`messages?limit=10` 應該 < 200ms
- Response headers：應該有 `X-Cache: HIT`（第二次請求後）

---

## 重要提醒

**沒有設定 `REDIS_URL`，KV cache 就不會工作，所有查詢都會直接走 DB。**

這就是為什麼還是很慢的原因。

