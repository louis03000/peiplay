# 🚀 部署檢查清單

**適用於**: 正式上線部署  
**最後更新**: 2025-01-09

---

## ✅ 部署前檢查

### 1. 環境變數設置

- [ ] `DATABASE_URL` - PostgreSQL 連接字串
- [ ] `REDIS_URL` - Redis 連接字串（速率限制需要）
- [ ] `NEXTAUTH_SECRET` - NextAuth 密鑰
- [ ] `NEXTAUTH_URL` - 應用程式 URL
- [ ] `CRON_SECRET` - Cron Job 驗證密鑰（可選）

### 2. 資料庫 Migration

執行以下 Migration：

```bash
# 1. 更新 SecurityLog schema
psql $DATABASE_URL -f prisma/migrations/update_security_log_schema.sql

# 2. 新增 PasswordHistory
psql $DATABASE_URL -f prisma/migrations/add_password_history.sql

# 3. 新增 Recovery Codes
psql $DATABASE_URL -f prisma/migrations/add_recovery_codes.sql

# 4. Prisma 同步
npx prisma generate
npx prisma db push
```

### 3. Redis 設置

- [ ] Redis 服務已啟動
- [ ] `REDIS_URL` 環境變數已設置
- [ ] 測試 Redis 連接：訪問 `/api/test-redis`

### 4. 備份設置

- [ ] 設置自動備份排程（見 `BACKUP_AND_DISASTER_RECOVERY.md`）
- [ ] 測試備份腳本：`node scripts/backup_postgresql.js`
- [ ] 驗證備份檔案生成

---

## 🔍 功能測試

### 速率限制

- [ ] 測試登入速率限制（5 次/分鐘）
- [ ] 測試註冊速率限制（3 次/小時）
- [ ] 驗證超過限制時返回 429
- [ ] 檢查 SecurityLog 是否有記錄

### CSRF 防護

- [ ] 登入後獲取 CSRF token：`/api/csrf-token`
- [ ] 測試 POST 請求需要 CSRF token
- [ ] 驗證缺少 token 時返回 403
- [ ] 檢查 SecurityLog 是否有記錄

### MFA

- [ ] 測試 MFA 設置流程
- [ ] 測試 TOTP 驗證
- [ ] 測試 Recovery Codes
- [ ] 測試管理員強制 MFA
- [ ] 驗證登入流程中的 MFA 檢查

### 密碼安全

- [ ] 測試密碼洩露檢查（HIBP）
- [ ] 測試密碼歷史檢查
- [ ] 測試密碼強度驗證

### Security Log

- [ ] 檢查 SecurityLog 表是否有記錄
- [ ] 驗證各種安全事件都有記錄
- [ ] 檢查 userId 可為 null（系統事件）

---

## 📊 監控設置

### 日誌監控

- [ ] 設置錯誤日誌監控
- [ ] 設置安全事件告警
- [ ] 設置速率限制觸發告警

### 備份監控

- [ ] 設置備份成功/失敗通知
- [ ] 定期檢查備份檔案
- [ ] 測試還原流程

---

## 🆘 緊急處理

### 如果速率限制失效

1. 檢查 Redis 連接
2. 檢查 `REDIS_URL` 環境變數
3. 查看錯誤日誌

### 如果 CSRF 驗證失敗

1. 檢查 Cookie 設置
2. 檢查前端是否正確發送 Header
3. 查看 SecurityLog 記錄

### 如果 MFA 無法使用

1. 檢查 `twoFactorSecret` 是否正確
2. 檢查 Recovery Codes 是否有效
3. 查看 SecurityLog 記錄

### 如果備份失敗

1. 檢查 `DATABASE_URL` 環境變數
2. 檢查磁碟空間
3. 檢查 `pg_dump` 是否可用
4. 查看備份日誌

---

## 📚 相關文檔

- `SECURITY_IMPLEMENTATION_SUMMARY.md` - 實作總結
- `BACKUP_AND_DISASTER_RECOVERY.md` - 備份策略
- `COMPREHENSIVE_SECURITY_GUIDE.md` - 綜合安全指南

---

**重要**: 所有安全機制必須在生產環境中測試驗證！

