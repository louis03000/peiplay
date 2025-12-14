#!/bin/bash

# Backfill ChatMessage denormalized fields
# 分批執行，避免 DB 負載過高

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-peiplay}"
DB_USER="${DB_USER:-postgres}"

BATCH_SIZE=1000
SLEEP_MS=300

echo "開始 Backfill ChatMessage denormalized fields..."
echo "批次大小: $BATCH_SIZE"
echo "每次間隔: ${SLEEP_MS}ms"

while true; do
  echo "執行批次更新..."
  
  # 執行 SQL
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
UPDATE "ChatMessage" m
SET 
  "senderName" = u.name,
  "senderAvatarUrl" = COALESCE(
    (SELECT "coverImage" FROM "Partner" WHERE "userId" = u.id),
    u.avatar
  )
FROM "User" u
WHERE m."senderId" = u.id
  AND (m."senderName" IS NULL OR m."senderAvatarUrl" IS NULL)
LIMIT $BATCH_SIZE;
EOF

  # 檢查是否還有未更新的記錄
  REMAINING=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) 
    FROM \"ChatMessage\" m
    JOIN \"User\" u ON m.\"senderId\" = u.id
    WHERE m.\"senderName\" IS NULL OR m.\"senderAvatarUrl\" IS NULL;
  " | tr -d ' ')

  if [ "$REMAINING" -eq 0 ]; then
    echo "✅ Backfill 完成！"
    break
  fi

  echo "剩餘 $REMAINING 筆記錄，等待 ${SLEEP_MS}ms 後繼續..."
  sleep $(echo "scale=3; $SLEEP_MS / 1000" | bc)
done

echo "✅ 所有記錄已更新完成！"

