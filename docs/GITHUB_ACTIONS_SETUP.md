# GitHub Actions 設定指南

## 預聊系統自動清理設定

本指南說明如何使用 GitHub Actions 自動清理過期的預聊房間。

## ✅ 優點

- **完全免費**：GitHub Actions 提供每月 2000 分鐘免費額度
- **穩定可靠**：GitHub 基礎設施，99.9% 可用性
- **易於調試**：可在 Actions 頁面查看執行日誌
- **手動觸發**：支援手動執行清理任務

## 📋 設定步驟

### 1. 生成 CRON_SECRET

在終端執行以下命令生成隨機密鑰：

```bash
openssl rand -hex 32
```

或使用 Node.js：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 設定 GitHub Secrets（在 GitHub 設定）

**📍 位置：GitHub Repository**

1. 前往你的 GitHub Repository
2. 點擊 **Settings** → **Secrets and variables** → **Actions**
3. 點擊 **New repository secret**
4. 添加以下 secrets：

| Secret 名稱 | 說明 | 範例值 |
|-----------|------|--------|
| `CRON_SECRET` | 用於驗證的隨機字串 | `a1b2c3d4e5f6...`（32 字元 hex） |
| `API_URL` | 你的 API 網址 | `https://your-domain.vercel.app` |

**💡 提示：**
- `CRON_SECRET` 可以用 `openssl rand -hex 32` 生成
- `API_URL` 是你的 Vercel 部署網址（或其他部署平台）

### 3. 設定環境變數（在 Vercel 設定）

**📍 位置：Vercel Dashboard**

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的專案
3. 點擊 **Settings** → **Environment Variables**
4. 添加以下環境變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `CRON_SECRET` | **與 GitHub Secrets 中的值完全相同** | 用於 API 驗證來自 GitHub Actions 的請求 |

**⚠️ 重要：**
- `CRON_SECRET` 的值必須與 GitHub Secrets 中的值**完全相同**
- 設定後需要重新部署才能生效

### 4. 驗證 Workflow 文件

確認 `.github/workflows/cleanup-pre-chat.yml` 文件存在且內容正確。

### 5. 測試執行

1. 前往 **Actions** 頁面
2. 選擇 **Cleanup Pre Chat** workflow
3. 點擊 **Run workflow** → **Run workflow**
4. 查看執行結果

## 🔍 檢查執行狀態

### 查看日誌

1. 前往 **Actions** 頁面
2. 點擊最新的 workflow run
3. 展開 **cleanup** job
4. 查看 **Run cleanup** step 的輸出

### 成功輸出範例

```
🧹 開始清理過期的預聊房間...
✅ 清理成功
{
  "success": true,
  "deleted": 5,
  "timestamp": "2023-01-01T12:00:00Z"
}
```

### 失敗處理

如果看到錯誤：

1. **401 Unauthorized**
   - 檢查 `CRON_SECRET` 是否正確設定
   - 確認 GitHub Secrets 和環境變數的值一致

2. **404 Not Found**
   - 檢查 `API_URL` 是否正確
   - 確認 API 路由已部署

3. **500 Internal Server Error**
   - 查看 API 日誌
   - 檢查資料庫連線

## ⚙️ 自訂排程

預設為每小時執行一次（UTC 時間）。如需修改，編輯 `.github/workflows/cleanup-pre-chat.yml`：

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # 每小時
    # - cron: '0 0 * * *'  # 每天午夜
    # - cron: '0 */6 * * *'  # 每 6 小時
```

Cron 語法說明：
- `0 * * * *` = 每小時的第 0 分鐘
- `0 0 * * *` = 每天 00:00 UTC
- `0 */6 * * *` = 每 6 小時

## 🔒 安全性

### 為什麼需要 CRON_SECRET？

防止未授權的請求觸發清理任務，避免：
- 惡意請求導致資料被刪除
- 資源濫用
- 服務中斷

### 最佳實踐

1. **使用強隨機密鑰**：至少 32 字元
2. **定期輪換**：每 3-6 個月更換一次
3. **不要提交到 Git**：確保 `.env` 在 `.gitignore` 中
4. **使用不同環境的密鑰**：開發、測試、生產環境使用不同的密鑰

## 📊 監控建議

### 設定通知

在 workflow 文件中添加失敗通知：

```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: '預聊清理任務失敗',
        body: '請檢查 Actions 日誌'
      })
```

### 監控指標

建議追蹤：
- 每次清理刪除的房間數量
- 執行時間
- 失敗次數

## 🆘 故障排除

### Workflow 沒有執行

1. 檢查 GitHub Actions 是否啟用
2. 確認 workflow 文件語法正確
3. 檢查排程時間（UTC）

### API 請求失敗

1. 檢查 API 是否正常運行
2. 驗證 `CRON_SECRET` 是否正確
3. 查看 API 日誌

### 資料庫連線問題

1. 確認資料庫連線字串正確
2. 檢查資料庫是否可從外部訪問
3. 驗證 IP 白名單設定

## 📚 相關文件

- [GitHub Actions 文檔](https://docs.github.com/en/actions)
- [Cron 語法說明](https://crontab.guru/)
- [預聊系統說明](./PRE_CHAT_SYSTEM.md)

