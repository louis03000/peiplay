# ⚡ 快速執行 Migration 指南

## 🚀 最簡單的方法（推薦）

### 方法 1：使用 Node.js 腳本（最簡單）

```bash
# 1. 設定資料庫 URL
# Windows PowerShell:
$env:DATABASE_URL="postgresql://user:password@host:5432/database"

# Windows CMD:
set DATABASE_URL=postgresql://user:password@host:5432/database

# Linux/Mac:
export DATABASE_URL="postgresql://user:password@host:5432/database"

# 2. 執行腳本
node scripts/run-migration.js
```

---

### 方法 2：使用 psql（直接執行 SQL）

```bash
# Windows PowerShell:
$env:DATABASE_URL="postgresql://user:password@host:5432/database"
psql $env:DATABASE_URL -f prisma/migrations/add_chat_message_denormalized_fields.sql

# Linux/Mac:
export DATABASE_URL="postgresql://user:password@host:5432/database"
psql $DATABASE_URL -f prisma/migrations/add_chat_message_denormalized_fields.sql
```

---

### 方法 3：使用 Prisma Migrate

```bash
# 1. 確保 schema.prisma 已更新（應該已經有了）
npx prisma format

# 2. 創建 migration
npx prisma migrate dev --name add_chat_message_denormalized_fields

# 3. 應用到 production
npx prisma migrate deploy
```

---

### 方法 4：使用資料庫 GUI 工具

1. **pgAdmin / DBeaver / TablePlus**：
   - 連接到資料庫
   - 打開 SQL 查詢視窗
   - 複製貼上以下 SQL：

```sql
-- Step 1: 添加字段
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立索引（分開執行，因為 CONCURRENTLY 不能在 transaction 中）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);
```

2. **Vercel / Railway / Supabase**：
   - 打開 Dashboard → Database → SQL Editor
   - 複製貼上上面的 SQL
   - 執行

---

## ⚠️ 重要注意事項

### 1. CONCURRENTLY 的限制

`CREATE INDEX CONCURRENTLY` **不能**在 transaction 中執行。

**❌ 錯誤做法**：
```sql
BEGIN;
CREATE INDEX CONCURRENTLY ...;  -- 這會報錯！
COMMIT;
```

**✅ 正確做法**：
```sql
-- 直接執行，不要 BEGIN/COMMIT
CREATE INDEX CONCURRENTLY ...;
```

### 2. 如果使用 GUI 工具

某些 GUI 工具會自動包裝在 transaction 中，需要：
- 關閉 "Auto-commit" 模式
- 或分開執行兩個 SQL（先執行 ALTER TABLE，再執行 CREATE INDEX）

---

## 🔍 驗證 Migration 是否成功

執行以下 SQL 檢查：

```sql
-- 1. 檢查字段是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ChatMessage' 
AND column_name IN ('senderName', 'senderAvatarUrl');

-- 2. 檢查索引是否存在
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
AND indexname = 'ChatMessage_roomId_createdAt_idx';

-- 3. 測試查詢性能
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

**預期結果**：
- 字段存在：`senderName` 和 `senderAvatarUrl`
- 索引存在：`ChatMessage_roomId_createdAt_idx`
- 查詢使用 Index Scan，Execution Time < 100ms

---

## 🚨 常見問題

### Q: 字段已存在怎麼辦？
A: 使用 `IF NOT EXISTS`，不會報錯，會安全跳過。

### Q: 索引已存在怎麼辦？
A: 使用 `IF NOT EXISTS`，不會報錯，會安全跳過。

### Q: CONCURRENTLY 報錯？
A: 確保不在 transaction 中執行，直接執行 SQL。

### Q: 找不到 psql？
A: 
- Windows: 安裝 PostgreSQL 或使用 GUI 工具
- Mac: `brew install postgresql`
- Linux: `sudo apt-get install postgresql-client`

---

**推薦使用方法 1（Node.js 腳本），最簡單！** ✅

