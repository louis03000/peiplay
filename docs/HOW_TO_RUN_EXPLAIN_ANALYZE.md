# 🔍 如何執行 EXPLAIN ANALYZE 診斷

## 📋 方法 1：使用 psql 命令（推薦）

### Windows

1. **開啟 PowerShell 或 CMD**

2. **設定 DATABASE_URL 環境變數**
   ```powershell
   # 方式 1：直接設定
   $env:DATABASE_URL="postgresql://user:password@host:port/database"
   
   # 方式 2：從 .env 檔案讀取（需要先安裝 dotenv-cli）
   # npm install -g dotenv-cli
   # dotenv -e .env.local
   ```

3. **執行腳本**
   ```powershell
   # 方式 1：直接執行
   psql $env:DATABASE_URL -f scripts/explain_analyze_queries.sql
   
   # 方式 2：使用批次檔（已自動處理環境變數）
   .\scripts\run_explain_analyze.bat
   ```

### macOS / Linux

1. **開啟終端**

2. **設定 DATABASE_URL 環境變數**
   ```bash
   # 方式 1：直接設定
   export DATABASE_URL="postgresql://user:password@host:port/database"
   
   # 方式 2：從 .env 檔案讀取
   export $(cat .env.local | grep DATABASE_URL | xargs)
   ```

3. **執行腳本**
   ```bash
   # 方式 1：直接執行
   psql $DATABASE_URL -f scripts/explain_analyze_queries.sql
   
   # 方式 2：使用 shell 腳本（已自動處理環境變數）
   chmod +x scripts/run_explain_analyze.sh
   ./scripts/run_explain_analyze.sh
   ```

---

## 📋 方法 2：使用 Node.js 腳本（如果沒有 psql）

### 執行步驟

1. **確保已安裝依賴**
   ```bash
   npm install
   ```

2. **執行 Node.js 腳本**
   ```bash
   node scripts/run_explain_analyze.js
   ```

**注意：** 這個腳本會自動從 `.env` 或 `.env.local` 讀取 `DATABASE_URL`。

---

## 📋 方法 3：在資料庫管理工具中執行

### 使用工具
- **pgAdmin**
- **DBeaver**
- **TablePlus**
- **Supabase Dashboard**（如果使用 Supabase）

### 執行步驟

1. 連接到資料庫
2. 開啟 SQL 編輯器
3. 複製 `scripts/explain_analyze_queries.sql` 的內容
4. 貼上並執行

---

## 📋 方法 4：在 Vercel / 生產環境

### 使用 Vercel CLI

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 連接到專案
vercel link

# 執行 SQL（需要先設定資料庫連線）
vercel env pull .env.local
psql $DATABASE_URL -f scripts/explain_analyze_queries.sql
```

### 使用 Supabase Dashboard

1. 登入 Supabase Dashboard
2. 選擇專案
3. 進入 **SQL Editor**
4. 複製 `scripts/explain_analyze_queries.sql` 的內容
5. 貼上並執行

---

## 🔧 常見問題

### Q1: 找不到 psql 命令

**解決方案：**

1. **安裝 PostgreSQL 客戶端**
   - Windows: 下載並安裝 [PostgreSQL](https://www.postgresql.org/download/)
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql-client`

2. **或使用 Node.js 腳本**
   ```bash
   node scripts/run_explain_analyze.js
   ```

### Q2: DATABASE_URL 格式錯誤

**正確格式：**
```
postgresql://username:password@host:port/database
```

**範例：**
```
postgresql://postgres:mypassword@localhost:5432/peiplay
```

### Q3: 連線被拒絕

**檢查項目：**
- 資料庫服務是否運行
- 主機和端口是否正確
- 防火牆設定
- 資料庫是否允許遠端連線

### Q4: 權限不足

**解決方案：**
- 確保資料庫用戶有執行 `EXPLAIN` 的權限
- 某些查詢（如 `pg_stat_statements`）需要超級用戶權限

---

## 📊 解讀結果

### 好的查詢計劃

```
Index Scan using idx_partner_status on "Partner"
  Index Cond: (status = 'APPROVED')
  Rows: 50
```

### 需要優化的查詢計劃

```
Seq Scan on "Partner"
  Filter: (status = 'APPROVED')
  Rows Removed by Filter: 10000  ← 這個數字很大，表示需要索引
```

### 關鍵指標

- **Seq Scan**: 全表掃描，通常很慢
- **Index Scan**: 使用索引掃描，通常很快
- **Index Only Scan**: 只掃描索引，最快
- **Rows Removed by Filter**: 過濾掉的行數，數字越大越需要優化

---

## 🎯 下一步

執行診斷後，根據結果：

1. **如果有 Seq Scan**：添加對應的索引
2. **如果 Rows Removed by Filter 很大**：優化查詢條件或添加索引
3. **如果查詢時間很長**：檢查是否有 N+1 query 或載入過多資料

參考文件：
- [完整診斷報告](../docs/PERFORMANCE_DIAGNOSIS_COMPLETE.md)
- [實施指南](../docs/OPTIMIZATION_IMPLEMENTATION_GUIDE.md)

