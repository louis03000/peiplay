#!/bin/bash
# ============================================
# 執行 EXPLAIN ANALYZE 診斷腳本
# ============================================

# 檢查 DATABASE_URL 環境變數
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 錯誤：DATABASE_URL 環境變數未設定"
  echo ""
  echo "請先設定 DATABASE_URL："
  echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
  echo ""
  echo "或使用 .env 檔案："
  echo "  source .env"
  echo ""
  exit 1
fi

echo "🔍 開始執行 EXPLAIN ANALYZE 診斷..."
echo ""

# 執行 SQL 腳本
psql "$DATABASE_URL" -f scripts/explain_analyze_queries.sql

echo ""
echo "✅ 診斷完成！請檢查上方的查詢計劃結果。"
echo ""
echo "📊 重點檢查項目："
echo "  - 是否有 'Seq Scan'（全表掃描）"
echo "  - 'Rows Removed by Filter' 是否很大"
echo "  - 是否使用了索引（'Index Scan' 或 'Index Only Scan'）"
echo ""

