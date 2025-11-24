# 🔧 修復 Prisma Migration Shadow Database 錯誤

## ❌ 錯誤訊息

```
Error: P3006
Migration `20240917_add_available_now_since` failed to apply cleanly to the shadow database.
Error code: P1014
The underlying table for model `Partner` does not exist.
```

## 📋 問題原因

`prisma migrate dev` 會建立一個臨時的 shadow database 來驗證 migration，但 shadow database 是空的，所以舊的 migration 無法執行（因為它們假設表已經存在）。

## ✅ 解決方案（3 選 1）

### 方法 1：直接在 Supabase 執行 SQL（推薦，最快）

**這是最簡單的方法，因為我們只需要添加一個欄位。**

1. **登入 Supabase Dashboard**
   - 前往 https://supabase.com/dashboard
   - 選擇您的專案

2. **打開 SQL Editor**
   - 左側選單 → SQL Editor
   - 點擊 "New query"

3. **執行 SQL**
   ```sql
   -- 添加 violationCount 欄位（如果不存在）
   ALTER TABLE "Customer" 
   ADD COLUMN IF NOT EXISTS "violationCount" INTEGER NOT NULL DEFAULT 0;

   -- 添加 violations 欄位（如果不存在）
   ALTER TABLE "Customer" 
   ADD COLUMN IF NOT EXISTS "violations" JSONB;
   ```

4. **點擊 Run 執行**

5. **重新生成 Prisma Client**
   ```bash
   npx prisma generate
   ```

6. **標記 migration 為已應用（可選）**
   ```bash
   npx prisma migrate resolve --applied add_violation_count_to_customer
   ```

### 方法 2：使用 `prisma db push`（快速同步）

這個方法會直接同步 schema 到資料庫，不建立 migration：

```bash
npx prisma db push
npx prisma generate
```

**注意：** 這不會建立 migration 記錄，但可以快速修復問題。

### 方法 3：禁用 Shadow Database（不推薦）

如果必須使用 `prisma migrate dev`，可以暫時禁用 shadow database：

在 `prisma/schema.prisma` 中添加：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("DATABASE_URL")  // 使用同一個資料庫作為 shadow
}
```

**⚠️ 警告：** 這不是最佳實踐，因為 shadow database 應該是一個獨立的資料庫。

## 🎯 推薦流程

1. ✅ **使用方法 1**：直接在 Supabase 執行 SQL（最快最安全）
2. ✅ 執行 `npx prisma generate` 重新生成 Prisma Client
3. ✅ 測試登入功能是否正常

## 📝 驗證

執行以下 SQL 檢查欄位是否存在：

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'Customer'
AND column_name IN ('violationCount', 'violations');
```

應該看到兩個欄位：
- `violationCount` (integer, default 0)
- `violations` (jsonb, nullable)




