# 備份與災難復原策略

**最後更新**: 2025-01-09  
**適用環境**: Production

---

## 📋 概述

本文檔說明 PeiPlay 平台的備份策略和災難復原流程，確保資料安全性和服務可用性。

---

## 🔄 備份策略

### 備份頻率

- **每日備份**: 每天凌晨 2:00 (UTC+8) 自動執行
- **保留期限**: 7 天（可調整）
- **備份類型**: 完整資料庫備份 (pg_dump)

### 備份內容

- 所有資料表資料
- 資料庫結構（Schema）
- 索引和約束
- 觸發器和函數

### 備份儲存

- **本地儲存**: `./backups/` 目錄
- **異地備份**: 建議定期同步到雲端儲存（如 AWS S3、Google Cloud Storage）

---

## 🛠️ 備份實作

### 方法 1: Shell 腳本（Linux/macOS）

```bash
# 設置環境變數
export DATABASE_URL="postgresql://user:password@host:port/database"
export BACKUP_DIR="./backups"
export RETENTION_DAYS=7

# 執行備份
chmod +x scripts/backup_postgresql.sh
./scripts/backup_postgresql.sh
```

### 方法 2: Node.js 腳本（跨平台）

```bash
# 設置環境變數
export DATABASE_URL="postgresql://user:password@host:port/database"
export BACKUP_DIR="./backups"
export RETENTION_DAYS=7

# 執行備份
node scripts/backup_postgresql.js
```

### 方法 3: 使用 npm script

```bash
# 在 package.json 中已定義
npm run db:backup
```

---

## ⏰ 自動化排程

### Linux/macOS (cron)

```bash
# 編輯 crontab
crontab -e

# 添加每日備份任務（每天凌晨 2:00）
0 2 * * * cd /path/to/peiplay && /path/to/scripts/backup_postgresql.sh >> /var/log/peiplay-backup.log 2>&1
```

### Windows (Task Scheduler)

1. 開啟「工作排程器」
2. 建立基本工作
3. 設定：
   - **名稱**: PeiPlay Daily Backup
   - **觸發程序**: 每日 02:00
   - **動作**: 啟動程式
   - **程式**: `node`
   - **引數**: `scripts/backup_postgresql.js`
   - **開始位置**: 專案根目錄

### Vercel/雲端環境

使用 Vercel Cron Jobs 或類似服務：

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 📦 備份檔案格式

- **檔名格式**: `backup_YYYY-MM-DD_HH-MM-SS.sql.gz`
- **壓縮格式**: gzip
- **檔案大小**: 通常為原始資料庫大小的 10-30%

---

## 🔄 還原流程

### 步驟 1: 選擇備份檔案

列出可用備份：
```bash
ls -lh backups/backup_*.sql.gz
```

### 步驟 2: 執行還原

**使用 Shell 腳本**:
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
./scripts/restore_postgresql.sh backups/backup_2025-01-09_12-00-00.sql.gz
```

**使用 psql 直接還原**:
```bash
gunzip -c backups/backup_2025-01-09_12-00-00.sql.gz | psql $DATABASE_URL
```

### 步驟 3: 驗證還原

```sql
-- 連接到資料庫
psql $DATABASE_URL

-- 檢查資料表
\dt

-- 檢查資料數量
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Booking";
```

---

## 🚨 災難復原計劃

### 場景 1: 資料庫損壞

1. **立即停止應用服務**（防止寫入損壞資料）
2. **評估損壞範圍**（檢查日誌、錯誤訊息）
3. **選擇最近的完整備份**
4. **還原到臨時環境測試**
5. **驗證資料完整性**
6. **還原到生產環境**
7. **重新啟動服務**

### 場景 2: 資料誤刪除

1. **立即停止相關操作**
2. **確認刪除範圍和時間**
3. **選擇刪除前的備份**
4. **部分還原**（僅還原受影響的資料表）
5. **驗證資料**

### 場景 3: 完整系統故障

1. **評估故障範圍**
2. **準備新環境**
3. **還原資料庫**
4. **還原應用程式**
5. **驗證服務功能**
6. **逐步恢復服務**

---

## 📊 備份監控

### 檢查備份狀態

```bash
# 檢查最新備份
ls -lht backups/ | head -5

# 檢查備份大小
du -sh backups/

# 檢查備份完整性
gunzip -t backups/backup_*.sql.gz
```

### 備份驗證腳本

建議定期執行備份驗證：

```bash
# 驗證最新備份是否可以還原
LATEST_BACKUP=$(ls -t backups/backup_*.sql.gz | head -1)
./scripts/restore_postgresql.sh "$LATEST_BACKUP" --dry-run
```

---

## 🔐 備份安全

### 加密

- 備份檔案包含敏感資料，建議加密儲存
- 使用 GPG 加密：
  ```bash
  gpg --encrypt --recipient backup@peiplay.com backup_*.sql.gz
  ```

### 存取控制

- 備份目錄應限制存取權限：
  ```bash
  chmod 700 backups/
  ```

### 異地備份

建議將備份同步到雲端：

```bash
# 使用 AWS CLI 上傳到 S3
aws s3 sync backups/ s3://peiplay-backups/ --delete

# 使用 rclone 上傳到 Google Drive
rclone sync backups/ gdrive:peiplay-backups/
```

---

## 📝 備份檢查清單

### 每日檢查

- [ ] 確認備份已執行
- [ ] 檢查備份檔案大小（不應為 0）
- [ ] 檢查備份檔案日期

### 每週檢查

- [ ] 驗證備份完整性
- [ ] 測試還原流程（在測試環境）
- [ ] 檢查備份儲存空間

### 每月檢查

- [ ] 完整災難復原演練
- [ ] 檢查異地備份狀態
- [ ] 更新備份策略（如需要）

---

## 🆘 緊急聯絡

如遇備份或還原問題：

1. **檢查日誌**: `logs/backup.log`
2. **檢查資料庫連接**: 確認 DATABASE_URL 正確
3. **檢查磁碟空間**: `df -h`
4. **聯絡系統管理員**

---

## 📚 相關文檔

- [PostgreSQL 備份文檔](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump 手冊](https://www.postgresql.org/docs/current/app-pgdump.html)
- [災難復原最佳實踐](https://www.postgresql.org/docs/current/backup-dump.html)

---

**重要提醒**: 
- 定期測試還原流程
- 保持多個備份副本
- 異地儲存備份
- 監控備份執行狀態

