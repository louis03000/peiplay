# 添加 partnerId 欄位到 Booking 表

## 問題描述
資料庫中的 `Booking` 表缺少 `partnerId` 欄位，導致創建預約時出現錯誤：
```
Invalid prisma.booking.create() invocation: The column partnerId does not exist
```

## 解決方案
執行此遷移來添加 `partnerId` 欄位。

## 執行方式

### 方式 1：使用 Prisma Migrate（推薦）
```bash
npx prisma migrate deploy
```

### 方式 2：手動執行 SQL（如果 migrate deploy 失敗）
連接到生產資料庫，執行 `migration.sql` 文件中的 SQL 語句。

### 方式 3：在 Vercel 上執行
1. 在 Vercel 專案設置中添加環境變數 `DATABASE_URL`
2. 在本地執行：
```bash
npx prisma migrate deploy
```
或者使用 Vercel CLI：
```bash
vercel env pull
npx prisma migrate deploy
```

## 遷移內容
- 添加 `partnerId` 欄位到 `Booking` 表
- 從 `Schedule` 表更新現有記錄的 `partnerId`
- 添加外鍵約束
- 添加索引以優化查詢性能

## 注意事項
- 此遷移會檢查欄位是否存在，可以安全地重複執行
- 如果資料庫中已有 `partnerId` 欄位，遷移會跳過添加步驟
- 遷移會自動更新現有記錄的 `partnerId` 值

