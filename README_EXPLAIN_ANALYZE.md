# 🔍 執行 EXPLAIN ANALYZE 診斷

## 🚀 最簡單的方式（推薦）

### 使用 npm script

```bash
npm run db:explain
```

這個命令會自動：
- 從 `.env` 或 `.env.local` 讀取 `DATABASE_URL`
- 執行所有 EXPLAIN ANALYZE 查詢
- 顯示查詢計劃結果

---

## 📋 其他執行方式

### 方式 1：使用 psql（如果有安裝 PostgreSQL 客戶端）

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://user:password@host:port/database"
psql $env:DATABASE_URL -f scripts/explain_analyze_queries.sql
```

**macOS / Linux:**
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
psql $DATABASE_URL -f scripts/explain_analyze_queries.sql
```

### 方式 2：使用提供的腳本

**Windows:**
```cmd
.\scripts\run_explain_analyze.bat
```

**macOS / Linux:**
```bash
chmod +x scripts/run_explain_analyze.sh
./scripts/run_explain_analyze.sh
```

### 方式 3：在資料庫管理工具中執行

1. 開啟 pgAdmin、DBeaver、TablePlus 或 Supabase Dashboard
2. 連接到資料庫
3. 開啟 SQL 編輯器
4. 複製 `scripts/explain_analyze_queries.sql` 的內容
5. 貼上並執行

---

## 📊 解讀結果

執行後，你會看到類似這樣的輸出：

### ✅ 好的查詢計劃（使用索引）

```
Index Scan using idx_partner_status on "Partner"
  Index Cond: (status = 'APPROVED')
  Planning Time: 0.123 ms
  Execution Time: 2.456 ms
```

### ⚠️ 需要優化的查詢計劃（全表掃描）

```
Seq Scan on "Partner"
  Filter: (status = 'APPROVED')
  Rows Removed by Filter: 10000
  Planning Time: 0.123 ms
  Execution Time: 1234.567 ms  ← 很慢！
```

### 🔍 關鍵指標

- **Seq Scan**: 全表掃描 → 需要添加索引
- **Index Scan**: 使用索引 → 很好
- **Index Only Scan**: 只掃描索引 → 最佳
- **Rows Removed by Filter**: 過濾掉的行數 → 數字越大越需要優化
- **Execution Time**: 執行時間 → 應該 < 100ms

---

## 🎯 下一步

根據診斷結果：

1. **如果有 Seq Scan**：執行 `npm run db:indexes` 添加索引
2. **如果 Execution Time 很長**：檢查是否有 N+1 query 或載入過多資料
3. **如果 Rows Removed by Filter 很大**：優化查詢條件

---

## 📚 詳細說明

更多資訊請參考：
- [完整執行指南](docs/HOW_TO_RUN_EXPLAIN_ANALYZE.md)
- [診斷報告](docs/PERFORMANCE_DIAGNOSIS_COMPLETE.md)
- [實施指南](docs/OPTIMIZATION_IMPLEMENTATION_GUIDE.md)

