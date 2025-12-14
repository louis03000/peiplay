# 🔧 部署修復指南

## 問題

`/api/partners/list` API 返回 400 錯誤：
```
Invalid `prisma.partner.findMany()` invocation: 
{ where: { status: "APPROVED", user: { select: { ... } } } }
Unknown argument `select`. Available options are listed in green.
```

## 原因

錯誤訊息顯示在 `where` 條件中有 `user: { select: ... }`，但這是不正確的 Prisma 語法。在 `where` 條件中不能使用 `select`。

**檔案已修復**：`app/api/partners/list/route.ts` 中已經移除了 `where` 條件中的 `user: { select: ... }`。

## 解決方案

### 方案 1：重新部署到 Vercel（推薦）

1. **提交並推送更改**
   ```bash
   git add .
   git commit -m "fix: 修復 partners/list API 的 Prisma 查詢語法錯誤"
   git push
   ```

2. **Vercel 會自動部署**
   - 如果已設定自動部署，Vercel 會自動重新建置
   - 等待部署完成（通常 1-2 分鐘）

3. **清除瀏覽器快取**
   - 按 `Ctrl + Shift + R` 強制重新載入
   - 或清除瀏覽器快取

### 方案 2：手動觸發 Vercel 重新部署

1. 登入 Vercel Dashboard
2. 選擇專案
3. 進入 "Deployments" 頁面
4. 點擊最新的部署
5. 選擇 "Redeploy"

### 方案 3：清除 Vercel 建置快取

如果重新部署後仍有問題，可能需要清除建置快取：

1. 在 Vercel Dashboard 中
2. 進入專案設定
3. 找到 "Build & Development Settings"
4. 清除建置快取
5. 重新部署

## 驗證修復

部署完成後，檢查：

1. **Network 標籤**
   - `/api/partners/list` 應該返回 200 狀態碼
   - 不應該有 `VALIDATION_ERROR`

2. **Console 標籤**
   - 不應該有 Prisma 錯誤訊息

3. **頁面顯示**
   - 應該能看到夥伴列表
   - 不應該顯示 "目前沒有可用的夥伴"

## 如果問題仍然存在

如果重新部署後問題仍然存在，請檢查：

1. **確認檔案已正確提交**
   ```bash
   git log --oneline -5
   git show HEAD:app/api/partners/list/route.ts | grep -A 5 "partnerWhere"
   ```

2. **檢查 Vercel 建置日誌**
   - 在 Vercel Dashboard 中查看建置日誌
   - 確認沒有建置錯誤

3. **檢查環境變數**
   - 確認 `DATABASE_URL` 正確設定
   - 確認 Redis 連線正常（如果使用快取）

## 檔案確認

確認 `app/api/partners/list/route.ts` 中的 `partnerWhere` 應該是：

```typescript
let partnerWhere: any = {
  status: 'APPROVED',
  ...(rankBooster ? { isRankBooster: true } : {}),
  ...(availableNow ? { isAvailableNow: true } : {}),
  // 注意：停權用戶過濾在應用層處理，避免 OR 條件影響索引
};
```

**不應該有：**
```typescript
user: {
  select: { ... }  // ❌ 錯誤：不能在 where 中使用 select
}
```

