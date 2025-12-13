# 🔒 資安實作總結

**實作日期**: 2025-01-09  
**標準**: 正式上線、可通過資安稽核

---

## ✅ 已完成的高風險問題修正

### 1️⃣ 速率限制（Redis-based）

**問題風險**: 無法防止暴力破解、DDoS 攻擊和 API 濫用

**解決方案**:
- 使用 Redis 實作真正的速率限制（支援多實例部署）
- 支援 IP 和 UserID 雙重限制
- 自動寫入 SecurityLog

**實際修改的檔案**:
- `lib/rate-limit-redis.ts` - 新增 Redis-based rate limiter
- `lib/middleware-rate-limit.ts` - 新增 rate limit middleware
- `lib/api-security.ts` - 更新使用 Redis rate limiter
- `app/api/auth/login-secure/route.ts` - 應用 AUTH preset (5次/分鐘)
- `app/api/auth/register-secure/route.ts` - 應用 REGISTER preset (3次/小時)

**Redis Key 設計**:
```
rate_limit:ip:{ip}:{endpoint?}
rate_limit:user:{userId}:{endpoint?}
```

**速率限制配置**:
- 登入/註冊: 5 次 / 分鐘 (IP + UserID)
- 一般 API: 60 次 / 分鐘 (IP)
- 敏感操作: 10 次 / 15 分鐘 (IP + UserID)
- 註冊: 3 次 / 小時 (IP)

---

### 2️⃣ CSRF 防護

**問題風險**: 容易受到跨站請求偽造攻擊

**解決方案**:
- 實作 Double Submit Cookie 模式
- 僅對有 Session 的狀態變更請求啟用
- 自動驗證並記錄失敗事件

**實際修改的檔案**:
- `lib/csrf-protection.ts` - 新增 CSRF 防護服務
- `lib/api-security.ts` - 更新 CSRF 驗證
- `app/api/auth/login-secure/route.ts` - 登入成功時設置 CSRF token
- `app/api/csrf-token/route.ts` - 新增 CSRF token API

**使用方式**:
```typescript
// 在 API route 中
const csrfResult = await validateCSRF(request);
if (!csrfResult.valid) {
  return csrfResult.response;
}
```

**前端配合**:
- 登入後從 Cookie 讀取 `csrf-token`
- 在所有 POST/PUT/PATCH/DELETE 請求的 Header 中發送 `X-CSRF-Token`

---

### 3️⃣ Security Log 寫入資料庫

**問題風險**: 無法追蹤安全事件、無法進行安全審計

**解決方案**:
- 所有安全事件寫入 SecurityLog 資料表
- 支援系統級事件（userId 可為 null）
- 新增事件類型：RATE_LIMIT_EXCEEDED, CSRF_TOKEN_INVALID, MFA_VERIFICATION_FAILED, PASSWORD_BREACHED_CHECK

**實際修改的檔案**:
- `lib/security-enhanced.ts` - 更新 SecurityLogger 寫入資料庫
- `prisma/schema.prisma` - 更新 SecurityLog model (userId 可為 null)
- `prisma/migrations/update_security_log_schema.sql` - Migration 文件

**記錄的事件**:
- 登入成功/失敗
- 速率限制觸發
- CSRF 驗證失敗
- MFA 驗證失敗
- 密碼變更
- 密碼洩露檢查

---

### 4️⃣ 密碼洩露檢查（HIBP）

**問題風險**: 用戶可能使用已洩露的密碼

**解決方案**:
- 整合 Have I Been Pwned API (k-Anonymity)
- 僅在註冊和密碼變更時檢查
- 不傳送完整密碼或 hash 到第三方

**實際修改的檔案**:
- `lib/password-breach-check.ts` - 新增 HIBP 整合
- `app/api/auth/register-secure/route.ts` - 註冊時檢查
- `app/api/user/change-password/route.ts` - 變更密碼時檢查

**實作細節**:
- 使用 SHA-1 hash 的前 5 個字符查詢
- 在本地比對完整 hash
- API 錯誤時允許密碼（記錄警告）

---

### 5️⃣ 密碼歷史

**問題風險**: 無法防止密碼重用

**解決方案**:
- 新增 PasswordHistory 表記錄最近 5 個密碼
- 禁止重複使用歷史密碼
- 記錄密碼更新時間（用於審計，不強制更新）

**實際修改的檔案**:
- `lib/password-history.ts` - 新增密碼歷史管理
- `prisma/schema.prisma` - 新增 PasswordHistory model 和 User.passwordUpdatedAt
- `prisma/migrations/add_password_history.sql` - Migration 文件
- `app/api/user/change-password/route.ts` - 使用密碼歷史檢查
- `app/api/auth/login-secure/route.ts` - 登入時檢查密碼年齡

**功能**:
- 記錄最近 5 個密碼 hash
- 檢查新密碼是否在歷史中
- 記錄密碼更新時間（用於審計）

---

## ✅ 已完成的高風險問題修正（續）

### 6️⃣ MFA（多因素認證）

**問題風險**: 缺少重要的帳號安全防護層

**解決方案**:
- 完善 TOTP 實作（使用 speakeasy）
- 登入流程中強制 MFA 驗證
- 管理員帳號強制啟用 MFA
- 提供 Recovery Codes（10 個，hash 儲存）
- MFA 失敗寫入 SecurityLog

**實際修改的檔案**:
- `lib/mfa-service.ts` - 新增 MFA 服務（TOTP、Recovery Codes）
- `app/api/auth/login-secure/route.ts` - 登入時檢查 MFA
- `app/api/auth/mfa-verify/route.ts` - MFA 驗證 API
- `app/api/2fa/setup/route.ts` - 更新使用新服務
- `app/api/2fa/verify/route.ts` - 更新使用新服務並生成 recovery codes
- `app/api/2fa/recovery-codes/route.ts` - 重新生成 recovery codes API
- `prisma/schema.prisma` - 新增 `recoveryCodes` 欄位
- `prisma/migrations/add_recovery_codes.sql` - Migration 文件

**功能**:
- TOTP 驗證（Google Authenticator 等）
- Recovery Codes（10 個，使用後自動刪除）
- 管理員強制啟用 MFA
- 登入流程整合 MFA 驗證
- 所有 MFA 事件寫入 SecurityLog

---

### 7️⃣ 備份與災難復原

**問題風險**: 資料遺失風險極高，無法快速恢復服務

**解決方案**:
- PostgreSQL 自動備份（使用 pg_dump）
- 保留 7 天備份
- 完整的備份策略和還原流程文檔
- 跨平台備份腳本（Shell + Node.js）
- 自動化排程支援

**實際修改的檔案**:
- `scripts/backup_postgresql.sh` - Shell 備份腳本（Linux/macOS）
- `scripts/backup_postgresql.js` - Node.js 備份腳本（跨平台）
- `scripts/restore_postgresql.sh` - 還原腳本
- `app/api/cron/backup/route.ts` - 自動備份 Cron API
- `BACKUP_AND_DISASTER_RECOVERY.md` - 完整的備份策略文檔

**功能**:
- 每日自動備份（可排程）
- 壓縮備份（gzip）
- 自動清理舊備份（7 天）
- 完整還原流程
- 災難復原計劃

---

## 📝 資料庫 Migration 說明

### 需要執行的 Migration

1. **更新 SecurityLog schema**:
   ```bash
   # 在 Supabase Dashboard 或 PostgreSQL 中執行
   psql $DATABASE_URL -f prisma/migrations/update_security_log_schema.sql
   ```

2. **新增 PasswordHistory**:
   ```bash
   psql $DATABASE_URL -f prisma/migrations/add_password_history.sql
   ```

3. **新增 Recovery Codes**:
   ```bash
   psql $DATABASE_URL -f prisma/migrations/add_recovery_codes.sql
   ```

4. **Prisma 同步**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

---

## 🔧 環境變數需求

### 必需
- `REDIS_URL` - Redis 連接字串（用於速率限制）

### 可選
- `NODE_ENV` - 環境模式（development/production）

---

## 🚀 部署檢查清單

### 部署前
- [ ] 執行所有 Migration
- [ ] 設置 `REDIS_URL` 環境變數
- [ ] 測試速率限制功能
- [ ] 測試 CSRF 防護
- [ ] 驗證 SecurityLog 寫入

### 部署後
- [ ] 檢查 Redis 連接
- [ ] 檢查 SecurityLog 表是否有記錄
- [ ] 測試登入速率限制
- [ ] 測試 CSRF token 驗證

---

## 📚 相關文檔

- `COMPREHENSIVE_SECURITY_GUIDE.md` - 綜合安全指南
- `SECURITY_AUDIT_REPORT.md` - 資安審計報告
- `lib/rate-limit-redis.ts` - 速率限制實作
- `lib/csrf-protection.ts` - CSRF 防護實作
- `lib/password-breach-check.ts` - 密碼洩露檢查實作
- `lib/password-history.ts` - 密碼歷史管理實作

---

**最後更新**: 2025-01-09

