# ✅ 預聊系統設定檢查清單

## 📍 兩個地方都需要設定

### 1️⃣ GitHub Secrets（在 GitHub 設定）

**用途：** 給 GitHub Actions workflow 使用

**設定位置：**
- GitHub Repository → Settings → Secrets and variables → Actions

**需要設定的 Secrets：**

| Secret 名稱 | 如何取得 | 範例值 |
|-----------|---------|--------|
| `CRON_SECRET` | 執行 `openssl rand -hex 32` | `a1b2c3d4e5f6...` |
| `API_URL` | 你的 Vercel 部署網址 | `https://your-app.vercel.app` |

**設定步驟：**
1. 生成 `CRON_SECRET`：
   ```bash
   openssl rand -hex 32
   ```
   複製這個值

2. 前往 GitHub Repository
3. Settings → Secrets and variables → Actions
4. 點擊 "New repository secret"
5. 添加 `CRON_SECRET`（貼上剛才生成的值）
6. 添加 `API_URL`（你的 Vercel 網址）

---

### 2️⃣ Vercel 環境變數（在 Vercel 設定）

**用途：** 給你的 API 使用，用來驗證請求

**設定位置：**
- Vercel Dashboard → 選擇專案 → Settings → Environment Variables

**需要設定的環境變數：**

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `CRON_SECRET` | **與 GitHub Secrets 中的值完全相同** | 用於 API 驗證 |

**設定步驟：**
1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的專案
3. Settings → Environment Variables
4. 添加 `CRON_SECRET`
   - Key: `CRON_SECRET`
   - Value: **貼上與 GitHub Secrets 中相同的值**
   - Environment: 選擇所有環境（Production, Preview, Development）
5. 點擊 "Save"
6. **重要：** 重新部署專案（或等待下次自動部署）

---

## 🔄 設定流程圖

```
1. 生成 CRON_SECRET
   └─> openssl rand -hex 32
   
2. 設定 GitHub Secrets
   └─> GitHub → Settings → Secrets → Actions
       ├─> CRON_SECRET: [生成的值]
       └─> API_URL: [你的 Vercel 網址]
   
3. 設定 Vercel 環境變數
   └─> Vercel Dashboard → Settings → Environment Variables
       └─> CRON_SECRET: [與 GitHub 相同的值]
   
4. 重新部署 Vercel
   └─> 讓環境變數生效
   
5. 測試 GitHub Actions
   └─> GitHub → Actions → Run workflow
```

---

## ✅ 驗證檢查

### GitHub Actions 設定檢查

- [ ] GitHub Secrets 中有 `CRON_SECRET`
- [ ] GitHub Secrets 中有 `API_URL`
- [ ] `API_URL` 指向正確的網址

### Vercel 環境變數檢查

- [ ] Vercel 環境變數中有 `CRON_SECRET`
- [ ] `CRON_SECRET` 值與 GitHub Secrets 中的值**完全相同**
- [ ] 環境變數已套用到所有環境（Production, Preview, Development）
- [ ] 已重新部署或等待自動部署

### 功能測試

- [ ] 前往 GitHub Actions 頁面
- [ ] 手動觸發 "Cleanup Pre Chat" workflow
- [ ] 查看執行結果，應該看到：
  ```
  ✅ 清理成功
  {
    "success": true,
    "deleted": 0,
    "timestamp": "..."
  }
  ```

---

## 🆘 常見問題

### Q: 為什麼需要設定兩次 CRON_SECRET？

**A:** 因為兩個系統需要互相驗證：
- **GitHub Actions** 需要這個值來調用你的 API
- **你的 API** 需要這個值來驗證請求是否來自 GitHub Actions

### Q: 如果值不一樣會怎樣？

**A:** API 會返回 401 Unauthorized，清理任務會失敗。

### Q: 如何確認值是否正確？

**A:** 
1. 在 GitHub Actions 執行時查看日誌
2. 如果看到 `401 Unauthorized`，表示值不一致
3. 如果看到 `✅ 清理成功`，表示設定正確

### Q: 設定後需要重新部署嗎？

**A:** 
- **GitHub Secrets**: 不需要，立即生效
- **Vercel 環境變數**: **需要**，必須重新部署才能生效

---

## 📚 相關文檔

- [GitHub Actions 設定指南](./GITHUB_ACTIONS_SETUP.md)
- [預聊系統說明](./PRE_CHAT_SYSTEM.md)

