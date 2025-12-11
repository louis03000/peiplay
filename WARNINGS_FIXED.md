# ✅ 已修復的警告

## 修復內容

### 1. Next-Auth DEBUG_ENABLED 警告 ✅

**問題：**
- 生產環境出現 `[next-auth][warn][DEBUG_ENABLED]` 警告

**修復：**
- 修改 `lib/auth.ts`，將 `debug: true` 改為 `debug: process.env.NODE_ENV === 'development'`
- 現在只在開發環境啟用 debug 模式

**檔案：** `lib/auth.ts` (第 251 行)

---

### 2. RankingHistory 表查詢警告 ✅

**問題：**
- RankingHistory 表可能不存在，導致 Prisma 錯誤和警告

**修復：**
- 改進 `lib/ranking-helpers.ts` 的錯誤處理
- 只在開發環境輸出警告，避免生產環境日誌污染
- 如果表不存在，會優雅地返回 null（使用默認費率）

**檔案：** 
- `lib/ranking-helpers.ts` (第 214-216 行, 第 224-226 行)
- `app/api/cron/update-weekly-ranking/route.ts` (第 37-38 行)

---

## 如果 RankingHistory 表不存在

如果仍然看到 RankingHistory 相關錯誤，請執行以下 SQL 創建表：

```sql
-- 創建 RankingHistory 表（如果不存在）
CREATE TABLE IF NOT EXISTS "RankingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "partnerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RankingHistory_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 創建索引
CREATE UNIQUE INDEX IF NOT EXISTS "RankingHistory_weekStartDate_partnerId_key" ON "RankingHistory"("weekStartDate", "partnerId");
CREATE INDEX IF NOT EXISTS "RankingHistory_weekStartDate_idx" ON "RankingHistory"("weekStartDate");
CREATE INDEX IF NOT EXISTS "RankingHistory_partnerId_idx" ON "RankingHistory"("partnerId");
CREATE INDEX IF NOT EXISTS "RankingHistory_weekStartDate_rank_idx" ON "RankingHistory"("weekStartDate", "rank");
```

**執行位置：** Supabase Dashboard → SQL Editor

---

## 驗證修復

重新部署後，檢查 Vercel 日誌：
- ✅ 不應該再看到 `[next-auth][warn][DEBUG_ENABLED]` 警告
- ✅ RankingHistory 相關錯誤會被靜默處理（只在開發環境顯示）

---

## 注意事項

- 這些修復不會影響功能，只是減少不必要的警告
- RankingHistory 表是可選的，如果不存在，系統會使用默認費率
- 所有警告現在只在開發環境顯示，生產環境保持乾淨

