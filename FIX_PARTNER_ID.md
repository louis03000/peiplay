# 🔧 修復 partnerId 欄位缺失問題

## 問題
資料庫中的 `Booking` 表缺少 `partnerId` 欄位，導致創建預約時出現錯誤：
```
Invalid prisma.booking.create() invocation: The column partnerId does not exist
```

## 解決方案

### 方法 1：使用 Supabase Dashboard（最簡單）⭐

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 點擊左側選單的 **SQL Editor**
4. 複製並執行以下 SQL：

```sql
-- 檢查欄位是否存在
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Booking' AND column_name = 'partnerId'
) AS column_exists;

-- 如果返回 false，執行以下語句：

-- 1. 添加欄位
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;

-- 2. 更新現有記錄
UPDATE "Booking" b
SET "partnerId" = s."partnerId"
FROM "Schedule" s
WHERE b."scheduleId" = s.id AND b."partnerId" IS NULL;

-- 3. 設定為 NOT NULL
ALTER TABLE "Booking" ALTER COLUMN "partnerId" SET NOT NULL;

-- 4. 添加外鍵約束
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Booking_partnerId_fkey'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
        FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. 添加索引
CREATE INDEX IF NOT EXISTS "Booking_partnerId_idx" ON "Booking"("partnerId");
CREATE INDEX IF NOT EXISTS "Booking_partnerId_createdAt_idx" ON "Booking"("partnerId", "createdAt" DESC);
```

### 方法 2：使用 API 端點

1. 設置環境變數 `FIX_DB_SECRET`（可選，用於安全）
2. 訪問或使用 curl：

```bash
curl -X POST https://peiplay.vercel.app/api/fix-database \
  -H "Authorization: Bearer temporary-fix-secret"
```

### 方法 3：使用 psql（本地）

```bash
psql $DATABASE_URL -f fix_partner_id.sql
```

## 驗證修復

執行以下查詢確認欄位已添加：

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Booking' AND column_name = 'partnerId';
```

應該返回：
- column_name: partnerId
- data_type: text
- is_nullable: NO

## 注意事項

- ⚠️ 此修復會更新所有現有記錄的 `partnerId`
- ✅ 可以安全地重複執行（使用 IF NOT EXISTS）
- 🔒 修復完成後，建議刪除 `/api/fix-database` 端點

