@echo off
REM ============================================
REM 執行 EXPLAIN ANALYZE 診斷腳本 (Windows)
REM ============================================

REM 檢查 DATABASE_URL 環境變數
if "%DATABASE_URL%"=="" (
  echo ❌ 錯誤：DATABASE_URL 環境變數未設定
  echo.
  echo 請先設定 DATABASE_URL：
  echo   set DATABASE_URL=postgresql://user:password@host:port/database
  echo.
  echo 或使用 .env 檔案（需要先安裝 dotenv-cli）：
  echo   dotenv -e .env.local -- psql %DATABASE_URL% -f scripts/explain_analyze_queries.sql
  echo.
  exit /b 1
)

echo 🔍 開始執行 EXPLAIN ANALYZE 診斷...
echo.

REM 執行 SQL 腳本
psql "%DATABASE_URL%" -f scripts/explain_analyze_queries.sql

echo.
echo ✅ 診斷完成！請檢查上方的查詢計劃結果。
echo.
echo 📊 重點檢查項目：
echo   - 是否有 'Seq Scan'（全表掃描）
echo   - 'Rows Removed by Filter' 是否很大
echo   - 是否使用了索引（'Index Scan' 或 'Index Only Scan'）
echo.

pause

