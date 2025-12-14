# 📋 執行 Database Migration 指南

## 方法 1：使用 Prisma Migrate（推薦）

### 步驟 1：檢查當前狀態

```bash
# 檢查 Prisma schema 是否已更新
npx prisma format

# 檢查資料庫狀態
npx prisma db pull
```

### 步驟 2：創建 Migration

```bash
# 創建新的 migration
npx prisma migrate dev --name add_chat_message_denormalized_fields

# 這會：
# 1. 生成 migration SQL
# 2. 應用到開發資料庫
# 3. 更新 Prisma Client
```

### 步驟 3：應用到 Production

```bash
# ⚠️ 在 production 環境執行（需要設定 DATABASE_URL）
npx prisma migrate deploy
```

---

## 方法 2：直接執行 SQL（如果 Prisma Migrate 有問題）

### 步驟 1：連接到資料庫

#### 選項 A：使用 psql（PostgreSQL 命令行）

```bash
# Windows (PowerShell)
$env:PGPASSWORD="your_password"
psql -h your_host -U your_user -d your_database

# 或直接指定連接字串
psql $DATABASE_URL
```

#### 選項 B：使用 pgAdmin 或其他 GUI 工具

1. 打開 pgAdmin / DBeaver / TablePlus
2. 連接到資料庫
3. 打開 SQL 查詢視窗

#### 選項 C：使用 Vercel / Railway / Supabase 的 SQL 編輯器

- Vercel: Dashboard → Storage → Postgres → SQL Editor
- Railway: Dashboard → Database → Query
- Supabase: Dashboard → SQL Editor

### 步驟 2：執行 Migration SQL

**⚠️ 重要：先備份資料庫！**

```sql
-- 備份（可選，但強烈建議）
-- pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql

-- Step 1: 添加字段（如果不存在）
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立索引（CONCURRENTLY 不鎖表）
-- ⚠️ 注意：CONCURRENTLY 必須在 transaction 外執行
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);
```

### 步驟 3：驗證

```sql
-- 檢查字段是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ChatMessage' 
AND column_name IN ('senderName', 'senderAvatarUrl');

-- 檢查索引是否存在
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
AND indexname = 'ChatMessage_roomId_createdAt_idx';

-- 測試查詢性能
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'test-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

**預期結果**：
- Index Scan using ChatMessage_roomId_createdAt_idx
- Execution Time: < 100ms

---

## 方法 3：使用 Node.js 腳本執行

創建一個腳本自動執行：

```bash
# 執行 migration 腳本
node scripts/run-migration.js
```

---

## ⚠️ 注意事項

### 1. CONCURRENTLY 的限制

`CREATE INDEX CONCURRENTLY` **不能**在 transaction 中執行：

```sql
-- ❌ 錯誤：不能在 transaction 中
BEGIN;
CREATE INDEX CONCURRENTLY ...;
COMMIT;

-- ✅ 正確：直接執行
CREATE INDEX CONCURRENTLY ...;
```

### 2. 生產環境執行時間

- **最佳時間**：低峰時段（例如凌晨 2-4 點）
- **執行時間**：取決於資料量（通常 < 1 分鐘）
- **影響**：CONCURRENTLY 不會鎖表，但會增加 CPU 使用

### 3. 如果字段已存在

如果字段已經存在，`ADD COLUMN IF NOT EXISTS` 不會報錯，會安全跳過。

### 4. 如果索引已存在

如果索引已經存在，`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 不會報錯，會安全跳過。

---

## 🔍 檢查 Migration 是否成功

### 1. 檢查字段

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ChatMessage' 
AND column_name IN ('senderName', 'senderAvatarUrl');
```

**預期結果**：
```
 column_name      | data_type | is_nullable
------------------+-----------+-------------
 senderName       | text      | YES
 senderAvatarUrl  | text      | YES
```

### 2. 檢查索引

```sql
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
AND indexname LIKE '%roomId%createdAt%';
```

**預期結果**：
```
 indexname                          | indexdef
------------------------------------+----------------------------------------
 ChatMessage_roomId_createdAt_idx   | CREATE INDEX ... ON "ChatMessage" ...
```

### 3. 測試查詢性能

```sql
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'your-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

**預期結果**：
- **Index Scan** using ChatMessage_roomId_createdAt_idx
- **Execution Time**: < 100ms

---

## 🚨 如果遇到錯誤

### 錯誤 1：字段已存在

```
ERROR: column "senderName" of relation "ChatMessage" already exists
```

**解決**：這是正常的，字段已經存在，可以跳過。

### 錯誤 2：索引已存在

```
ERROR: relation "ChatMessage_roomId_createdAt_idx" already exists
```

**解決**：這是正常的，索引已經存在，可以跳過。

### 錯誤 3：CONCURRENTLY 在 transaction 中

```
ERROR: CREATE INDEX CONCURRENTLY cannot be executed from a function or multi-command string
```

**解決**：確保不在 transaction 中執行，直接執行 SQL。

---

## 📝 快速執行命令（複製貼上）

### 使用 psql

```bash
# 設定環境變數（Windows PowerShell）
$env:DATABASE_URL="postgresql://user:password@host:5432/database"

# 執行 migration
psql $env:DATABASE_URL -f prisma/migrations/add_chat_message_denormalized_fields.sql
```

### 使用 Node.js

```bash
# 執行 migration 腳本
node -e "
const { execSync } = require('child_process');
const sql = \`
ALTER TABLE \"ChatMessage\"
ADD COLUMN IF NOT EXISTS \"senderName\" TEXT,
ADD COLUMN IF NOT EXISTS \"senderAvatarUrl\" TEXT;
\`;
execSync(\`psql \$DATABASE_URL -c \"\${sql}\"\`, { stdio: 'inherit' });
"
```

---

**完成後，請執行驗證 SQL 確認 migration 成功！** ✅

