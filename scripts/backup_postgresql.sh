#!/bin/bash
# PostgreSQL 資料庫備份腳本
# 使用 pg_dump 進行完整備份

set -e  # 遇到錯誤立即退出

# 從環境變數讀取資料庫連接資訊
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# 檢查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 錯誤: DATABASE_URL 環境變數未設置"
  exit 1
fi

# 解析 DATABASE_URL
# 格式: postgresql://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')

# 如果解析失敗，嘗試直接使用 DATABASE_URL
if [ -z "$DB_NAME" ]; then
  echo "⚠️  無法解析 DATABASE_URL，嘗試直接使用..."
  PGDATABASE_URL="$DATABASE_URL"
else
  # 設置 PostgreSQL 環境變數
  export PGHOST="$DB_HOST"
  export PGPORT="${DB_PORT:-5432}"
  export PGDATABASE="$DB_NAME"
  export PGUSER="$DB_USER"
  export PGPASSWORD="$DB_PASS"
  PGDATABASE_URL=""
fi

# 創建備份目錄
mkdir -p "$BACKUP_DIR"

# 生成備份檔名（格式: backup_YYYY-MM-DD_HH-MM-SS.sql.gz）
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

echo "🔄 開始備份資料庫..."
echo "   資料庫: $DB_NAME"
echo "   主機: $DB_HOST"
echo "   備份檔: $BACKUP_FILE"

# 執行備份
if [ -n "$PGDATABASE_URL" ]; then
  # 使用完整的 DATABASE_URL
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
else
  # 使用環境變數
  pg_dump | gzip > "$BACKUP_FILE"
fi

# 檢查備份是否成功
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ 備份完成: $BACKUP_FILE ($BACKUP_SIZE)"
else
  echo "❌ 備份失敗"
  exit 1
fi

# 清理舊備份（保留指定天數）
echo "🧹 清理 $RETENTION_DAYS 天前的舊備份..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "✅ 清理完成"

# 列出當前備份
echo ""
echo "📦 當前備份列表:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -5 || echo "   (無備份檔案)"

echo ""
echo "✅ 備份流程完成"

