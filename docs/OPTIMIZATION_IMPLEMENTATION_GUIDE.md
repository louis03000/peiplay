# 🚀 效能優化實施指南

## 📋 快速開始

### 步驟 1：執行 EXPLAIN ANALYZE 診斷

```bash
# 連接到資料庫並執行診斷腳本
psql $DATABASE_URL -f scripts/explain_analyze_queries.sql
```

**檢查重點：**
- 是否有 `Seq Scan`（全表掃描）
- `Rows Removed by Filter` 是否很大
- 是否使用了索引（`Index Scan` 或 `Index Only Scan`）

### 步驟 2：添加缺失的索引

```bash
# 執行索引優化腳本
psql $DATABASE_URL -f scripts/add_missing_indexes.sql
```

**注意：**
- 在生產環境執行前請先備份
- 大表的索引建立可能需要較長時間
- 建議在低峰時段執行

### 步驟 3：驗證索引使用情況

```sql
-- 檢查索引掃描次數
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## 🔧 已實施的優化

### 1. ✅ 優化 `partners/search-by-time` API

**修改內容：**
- 將 `include` 改為 `select`，只查詢必要欄位
- 添加 `take: 100` 限制結果數量
- 移除 `reviewsReceived` 的嵌套查詢
- 改用批量聚合查詢獲取平均評分（避免 N+1）

**預期改善：** 查詢時間從 3-5 秒降低到 <1 秒

**檔案：** `app/api/partners/search-by-time/route.ts`

---

## 📊 效能監控

### 監控查詢時間

在開發環境中，Prisma 已啟用查詢日誌：

```typescript
// lib/prisma.ts
log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn', 'info'] : ['error'],
```

### 使用慢查詢 API

```bash
# 獲取最慢的查詢
GET /api/admin/slow-queries?type=slowest&limit=20
```

---

## 🎯 下一步優化建議

### 優先級 1：立即執行

1. **執行 EXPLAIN ANALYZE**
   - 確認實際查詢計劃
   - 找出未使用索引的查詢

2. **優化 OR 條件**
   - 檢查 `app/api/partners/route.ts` 中的 OR 條件
   - 改為應用層過濾

### 優先級 2：短期優化

1. **添加快取**
   - `/api/reviews/public` - 公開評價（變動低）
   - `/api/partners/ranking` - 排名（變動低）

2. **添加 GIN Index**
   - 如果 `games` 陣列查詢頻繁且資料量大
   - 執行：`CREATE INDEX idx_partner_games_gin ON "Partner" USING GIN (games);`

### 優先級 3：長期優化

1. **資料庫連線池優化**
   - 檢查連線池配置是否適合當前負載
   - 考慮使用 Supabase Pooler（如果使用 Supabase）

2. **查詢結果快取策略**
   - 為更多高頻讀取 API 添加 Redis 快取
   - 設定合理的 TTL

---

## ⚠️ 注意事項

### 索引維護

- 索引會增加寫入時間
- 定期檢查未使用的索引並考慮移除
- 監控索引大小，避免過度索引

### 快取策略

- 確保快取失效機制正確
- 監控快取命中率
- 避免快取過期導致資料不一致

### 測試

- 在開發環境充分測試後再部署到生產
- 使用真實資料量進行測試
- 監控生產環境的效能指標

---

## 📝 檢查清單

部署前確認：

- [ ] 已執行 EXPLAIN ANALYZE 並確認查詢計劃
- [ ] 已添加必要的索引
- [ ] 已優化所有使用 `include` 的查詢
- [ ] 已為所有列表 API 添加 `take` 限制
- [ ] 已修正所有 N+1 query
- [ ] 已在開發環境測試效能改善
- [ ] 已備份資料庫（生產環境）
- [ ] 已準備回滾方案

---

## 🔗 相關文件

- [完整診斷報告](./PERFORMANCE_DIAGNOSIS_COMPLETE.md)
- [API 優化指南](./COMPREHENSIVE_API_OPTIMIZATION.md)
- [索引優化腳本](../scripts/add_missing_indexes.sql)
- [EXPLAIN ANALYZE 腳本](../scripts/explain_analyze_queries.sql)

