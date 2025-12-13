#!/bin/bash
# PostgreSQL 資料庫還原腳本

set -e  # 遇到錯誤立即退出

# 從環境變數讀取資料庫連接資訊
DATABASE_URL="${DATABASE_URL:-}"
BACKUP_FILE="${1:-}"

# 檢查參數
if [ -z "$BACKUP_FILE" ]; then
  echo "❌ 錯誤: 請指定備份檔案"
  echo "用法: $0 <備份檔案路徑>"
  echo "範例: $0 ./backups/backup_2025-01-09_12-00-00.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 錯誤: 備份檔案不存在: $BACKUP_FILE"
  exit 1
fi

# 檢查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 錯誤: DATABASE_URL 環境變數未設置"
  exit 1
fi

# 解析 DATABASE_URL
DB_USER=$(echo $DATABASE_URL | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')

# 確認還原
echo "⚠️  警告: 此操作將覆蓋現有資料庫！"
echo "   資料庫: $DB_NAME"
echo "   主機: $DB_HOST"
echo "   備份檔: $BACKUP_FILE"
echo ""
read -p "確定要繼續嗎？(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ 已取消還原"
  exit 0
fi

# 設置 PostgreSQL 環境變數
if [ -n "$DB_NAME" ]; then
  export PGHOST="$DB_HOST"
  export PGPORT="${DB_PORT:-5432}"
  export PGDATABASE="$DB_NAME"
  export PGUSER="$DB_USER"
  export PGPASSWORD="$DB_PASS"
  PGDATABASE_URL=""
else
  PGDATABASE_URL="$DATABASE_URL"
fi

echo "🔄 開始還原資料庫..."

# 如果是 .gz 檔案，先解壓縮
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "   解壓縮備份檔案..."
  TEMP_FILE=$(mktemp)
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  
  # 執行還原
  if [ -n "$PGDATABASE_URL" ]; then
    psql "$DATABASE_URL" < "$TEMP_FILE"
  else
    psql < "$TEMP_FILE"
  fi
  
  # 清理臨時檔案
  rm "$TEMP_FILE"
else
  # 直接還原
  if [ -n "$PGDATABASE_URL" ]; then
    psql "$DATABASE_URL" < "$BACKUP_FILE"
  else
    psql < "$BACKUP_FILE"
  fi
fi

if [ $? -eq 0 ]; then
  echo "✅ 還原完成"
else
  echo "❌ 還原失敗"
  exit 1
fi

