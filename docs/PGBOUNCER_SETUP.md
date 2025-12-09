# PgBouncer 設定指南

## 概述

PgBouncer 是一個輕量級的 PostgreSQL 連線池管理器，用於減少資料庫連線數並提升效能。

## 為什麼需要 PgBouncer？

1. **減少連線數**：Node.js 應用可能建立大量資料庫連線，PgBouncer 可以將這些連線複用
2. **提升效能**：減少連線建立/關閉的開銷
3. **保護資料庫**：避免超過 PostgreSQL 的 `max_connections` 限制

## 安裝

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install pgbouncer
```

### macOS
```bash
brew install pgbouncer
```

### 從源碼編譯
```bash
wget https://www.pgbouncer.org/downloads/files/1.21.0/pgbouncer-1.21.0.tar.gz
tar -xzf pgbouncer-1.21.0.tar.gz
cd pgbouncer-1.21.0
./configure --prefix=/usr/local
make && sudo make install
```

## 配置

### 1. 複製範例配置檔
```bash
sudo cp config/pgbouncer.ini.example /etc/pgbouncer/pgbouncer.ini
```

### 2. 編輯配置檔
```bash
sudo nano /etc/pgbouncer/pgbouncer.ini
```

關鍵設定：
- `pool_mode = transaction` - 使用 transaction pooling（推薦）
- `max_client_conn = 100` - 根據應用需求調整
- `default_pool_size = 25` - 根據 PostgreSQL max_connections 調整

### 3. 建立用戶清單檔
```bash
sudo nano /etc/pgbouncer/userlist.txt
```

格式：
```
"username" "md5_hash_of_password"
```

生成 MD5 hash：
```bash
echo -n "passwordusername" | md5sum
```

### 4. 設定權限
```bash
sudo chown pgbouncer:pgbouncer /etc/pgbouncer/pgbouncer.ini
sudo chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt
```

## 啟動與管理

### 啟動 PgBouncer
```bash
sudo systemctl start pgbouncer
sudo systemctl enable pgbouncer  # 開機自動啟動
```

### 檢查狀態
```bash
sudo systemctl status pgbouncer
```

### 連線測試
```bash
psql -h localhost -p 6432 -U username -d peiplay
```

### 管理命令
```bash
# 連線到 PgBouncer 管理介面
psql -h localhost -p 6432 -U postgres -d pgbouncer

# 查看統計資訊
SHOW STATS;

# 查看連線池狀態
SHOW POOLS;

# 查看活動連線
SHOW CLIENTS;

# 查看伺服器連線
SHOW SERVERS;

# 重新載入配置（不中斷連線）
RELOAD;
```

## 應用程式連線設定

### 更新 DATABASE_URL
```env
# 原本直接連到 PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/peiplay

# 改為透過 PgBouncer
DATABASE_URL=postgresql://user:password@localhost:6432/peiplay
```

### Prisma 設定
Prisma 會自動使用新的 DATABASE_URL，無需額外設定。

## 監控

### 查看連線統計
```sql
-- 連線到 PgBouncer 管理介面
psql -h localhost -p 6432 -U postgres -d pgbouncer

-- 查看統計
SHOW STATS;
```

### 查看日誌
```bash
sudo tail -f /var/log/pgbouncer/pgbouncer.log
```

## 效能調優建議

### 1. Pool Size 設定
- `default_pool_size`：建議設為 PostgreSQL `max_connections` 的 25-50%
- 例如：PostgreSQL max_connections = 100，則設為 25-50

### 2. Pool Mode 選擇
- **transaction**（推薦）：每個交易使用一個連線，效能最佳
- **session**：每個會話使用一個連線，相容性最好但效能較差
- **statement**：每個語句使用一個連線，最激進但可能有問題

### 3. 連線數計算
```
max_client_conn = (應用伺服器數量 × 每個伺服器的 worker 數) + 緩衝
```

例如：
- 4 個 Node.js 伺服器
- 每個伺服器 10 個 worker
- 計算：4 × 10 = 40，加上緩衝 = 100

### 4. PostgreSQL 設定調整
在 `postgresql.conf` 中：
```conf
max_connections = 100  # 根據 default_pool_size 調整
shared_buffers = 256MB
work_mem = 4MB
```

## 常見問題

### 1. 連線被拒絕
- 檢查 PgBouncer 是否運行：`sudo systemctl status pgbouncer`
- 檢查防火牆設定
- 檢查 `listen_addr` 和 `listen_port` 設定

### 2. 認證失敗
- 檢查 `userlist.txt` 格式是否正確
- 檢查 MD5 hash 是否正確
- 檢查 `auth_file` 路徑是否正確

### 3. 連線數不足
- 增加 `max_client_conn`
- 增加 `default_pool_size`
- 檢查應用程式是否有連線洩漏

### 4. 查詢超時
- 檢查 `query_timeout` 設定
- 檢查 `query_wait_timeout` 設定
- 檢查 PostgreSQL 的 `statement_timeout`

## 生產環境建議

1. **使用 systemd 管理**：確保 PgBouncer 自動重啟
2. **監控連線數**：設定告警當連線數接近上限
3. **日誌輪轉**：設定 logrotate 避免日誌檔案過大
4. **備份配置**：定期備份配置檔和 userlist.txt
5. **SSL/TLS**：生產環境建議啟用 SSL 連線

## 相關文件

- [PgBouncer 官方文件](https://www.pgbouncer.org/)
- [PostgreSQL 連線池最佳實踐](https://www.postgresql.org/docs/current/runtime-config-connection.html)

