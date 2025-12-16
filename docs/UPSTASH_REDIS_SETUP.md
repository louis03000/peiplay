# Upstash Redis 設定指南（Vercel Serverless 專用）

## ⚠️ 重要說明

**Upstash 是 HTTP Redis，不是 TCP Redis！**

- ❌ **不能用** `redis` 或 `ioredis` 套件（TCP socket）
- ✅ **必須用** `@upstash/redis` 套件（HTTP 模式）
- ✅ **適用於** Vercel Serverless（無長連線限制）

---

## 📍 步驟 1：從 Upstash Dashboard 獲取環境變數

### 1. 前往 Upstash Dashboard
- 打開 [Upstash Console](https://console.upstash.com/)
- 選擇你的 Redis 資料庫

### 2. 切換到 REST Tab
- 在 "Connect" 區塊中，找到 "REST" 和 "TCP" 兩個 tab
- **點擊 "REST" tab**（不是 TCP！）

### 3. 複製兩個環境變數

你會看到兩個值：

1. **UPSTASH_REDIS_REST_URL**
   - 格式：`https://xxx.upstash.io`
   - 範例：`https://harmless-llama-5233.upstash.io`

2. **UPSTASH_REDIS_REST_TOKEN**
   - 格式：長字串 token
   - 範例：`ARRXAAImCDEyNTZmZmQ4Y2Q0MzM0YjA5...`

**⚠️ 重要：直接複製，不要自己拼！**

---

## 📝 步驟 2：在 Vercel 設定環境變數

### 1. 前往 Vercel Dashboard
- 打開 [Vercel Dashboard](https://vercel.com/dashboard)
- 選擇 `peiplay` 專案

### 2. 進入 Settings → Environment Variables

### 3. 添加兩個環境變數

| Name | Value | Environment |
|------|-------|------------|
| `UPSTASH_REDIS_REST_URL` | 從 Upstash REST tab 複製的 URL | Production, Preview, Development |
| `UPSTASH_REDIS_REST_TOKEN` | 從 Upstash REST tab 複製的 Token | Production, Preview, Development |

**⚠️ 重要：**
- 兩個都要設定
- 選擇所有環境（Production, Preview, Development）
- 設定後需要重新部署

---

## ✅ 步驟 3：驗證設定

### 1. 重新部署
- 在 Vercel Dashboard 點擊 "Redeploy"
- 或 push 新的 commit 觸發自動部署

### 2. 測試
- 打開聊天室頁面
- 打開 Chrome DevTools → Network 面板
- 找到 `messages?limit=10` 請求
- 查看 Response Headers：
  - `X-Redis-Status` 應該是 `SET`
  - `X-Cache` 第一次應該是 `MISS`，第二次應該是 `HIT`

### 3. 檢查 Vercel Logs
在 Vercel Logs 中搜尋：
- `✅ Creating Upstash Redis client (HTTP mode)` - 成功
- `❌ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set` - 環境變數未設定

---

## 🔍 常見問題

### Q: 為什麼不能用 `REDIS_URL`？
A: `REDIS_URL` 是 TCP Redis 的格式（`rediss://...`），但 Upstash 在 Vercel 必須用 HTTP 模式，需要兩個分開的環境變數。

### Q: 為什麼 Dashboard 顯示有 Reads/Writes？
A: 那是因為 Upstash Dashboard 本身在呼叫 API，或你之前用其他方式測試過，不代表你的 Vercel function 連成功。

### Q: 為什麼一直 `X-Cache: MISS`？
A: 檢查：
1. 環境變數是否正確設定（兩個都要）
2. 是否重新部署了
3. Vercel Logs 中是否有錯誤訊息

---

## 📚 參考資料

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [@upstash/redis npm package](https://www.npmjs.com/package/@upstash/redis)

