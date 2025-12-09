# PeiPlay 平台全面修復與強化 - 實施指南

## 🎯 專案概述

本專案旨在全面修復與強化 PeiPlay 平台，涵蓋資料庫優化、效能提升、安全強化、合規準備等各個方面。

## ✅ 已完成的核心基礎設施

### 1. 資料庫 Schema 擴展
- ✅ 新增 KYC、PartnerVerification、Payment、RefundRequest、SupportTicket、SupportMessage、LogEntry 模型
- ✅ 優化 Booking 模型（添加 partnerId 直接關聯）
- ✅ 完整的索引設計

### 2. 資料庫效能優化
- ✅ 索引優化 SQL 腳本（包含 full-text search、pg_trgm）
- ✅ pg_stat_statements 啟用腳本
- ✅ 慢查詢分析腳本

### 3. Redis Cache 層
- ✅ 統一的 cache 介面
- ✅ Cache invalidation 策略
- ✅ 完整的文件說明

### 4. 安全強化
- ✅ Argon2 密碼雜湊模組
- ✅ 敏感資料加密模組
- ✅ 密碼強度驗證

### 5. 連線池優化
- ✅ PgBouncer 配置範例
- ✅ 完整的設定指南

### 6. 合規文件
- ✅ 服務條款（TOS）
- ✅ 隱私權政策

## 🚀 快速開始

### 步驟 1：安裝依賴

```bash
# 安裝 Redis 客戶端
npm install redis

# 安裝 Argon2（用於密碼雜湊）
npm install argon2

# 安裝其他可能需要的套件
npm install
```

### 步驟 2：執行資料庫 Migration

**選項 A：使用 Prisma Migration（推薦）**
```bash
npx prisma migrate dev --name add_kyc_payment_refund_models
```

**選項 B：手動執行 SQL（如果 Prisma migration 失敗）**
```bash
psql $DATABASE_URL -f prisma/migrations/manual_add_kyc_payment_refund_models.sql
```

### 步驟 3：執行索引優化

```bash
psql $DATABASE_URL -f scripts/database_performance_indexes.sql
```

### 步驟 4：啟用 pg_stat_statements

```bash
psql $DATABASE_URL -f scripts/enable_pg_stat_statements.sql
```

### 步驟 5：設定環境變數

在 `.env` 檔案中添加：

```env
# Redis
REDIS_URL=redis://localhost:6379

# 加密金鑰（32 bytes hex，用於敏感資料加密）
ENCRYPTION_KEY=your-32-byte-hex-key-here

# Hash Pepper（用於敏感資料雜湊）
HASH_PEPPER=your-pepper-string-here
```

生成 ENCRYPTION_KEY：
```bash
# 使用 openssl
openssl rand -hex 32
```

### 步驟 6：驗證安裝

```bash
# 驗證 Prisma schema
npx prisma validate

# 生成 Prisma Client
npx prisma generate

# 檢查資料庫連線
npx prisma db pull
```

## 📁 檔案結構

```
Peiplay2/
├── prisma/
│   ├── schema.prisma                    # 擴展後的 schema
│   └── migrations/
│       └── manual_add_kyc_payment_refund_models.sql  # 手動 migration
├── scripts/
│   ├── database_performance_indexes.sql # 索引優化
│   ├── enable_pg_stat_statements.sql    # 啟用查詢統計
│   └── slow_query_analysis.sql         # 慢查詢分析
├── lib/
│   ├── redis-cache.ts                   # Redis cache 層
│   └── security-enhanced-v2.ts          # 安全強化模組
├── config/
│   └── pgbouncer.ini.example            # PgBouncer 配置範例
└── docs/
    ├── REDIS_CACHE_STRATEGY.md          # Cache 策略
    ├── PGBOUNCER_SETUP.md               # PgBouncer 設定指南
    ├── IMPLEMENTATION_SUMMARY.md        # 實施總結
    └── legal/
        ├── TERMS_OF_SERVICE.md          # 服務條款
        └── PRIVACY_POLICY.md            # 隱私權政策
```

## 🔧 使用指南

### Redis Cache

```typescript
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache';

// 讀取 cache
const partner = await Cache.getOrSet(
  CacheKeys.partners.detail(partnerId),
  async () => await db.partner.findUnique({ where: { id: partnerId } }),
  CacheTTL.MEDIUM
);

// 清除 cache
import { CacheInvalidation } from '@/lib/redis-cache';
await CacheInvalidation.onPartnerUpdate(partnerId);
```

### 安全模組

```typescript
import { hashPassword, verifyPassword, encryptSensitiveData } from '@/lib/security-enhanced-v2';

// 雜湊密碼
const hashedPassword = await hashPassword('userPassword123');

// 驗證密碼
const isValid = await verifyPassword('userPassword123', hashedPassword);

// 加密敏感資料
const encrypted = encryptSensitiveData('sensitive-data');
```

## 📊 監控與除錯

### 查看慢查詢

```bash
psql $DATABASE_URL -f scripts/slow_query_analysis.sql
```

### 查看 Cache 狀態

```bash
redis-cli
> KEYS partners:*
> GET partners:detail:abc123
> TTL partners:detail:abc123
```

### 查看 PgBouncer 狀態

```bash
psql -h localhost -p 6432 -U postgres -d pgbouncer
> SHOW STATS;
> SHOW POOLS;
```

## ⚠️ 注意事項

1. **資料庫備份**：執行 migration 前務必備份資料庫
2. **環境變數**：確保所有必要的環境變數都已設定
3. **Redis 連線**：確保 Redis 服務正在運行
4. **索引建立**：大型表的索引建立可能需要較長時間，建議在低峰時段執行
5. **測試環境**：建議先在測試環境驗證所有變更

## 🐛 常見問題

### Migration 失敗

如果 Prisma migration 失敗，可以使用手動 SQL migration：
```bash
psql $DATABASE_URL -f prisma/migrations/manual_add_kyc_payment_refund_models.sql
```

### Redis 連線失敗

檢查：
1. Redis 服務是否運行
2. REDIS_URL 環境變數是否正確
3. 防火牆設定

### 索引建立緩慢

大型表的索引建立可能需要較長時間，這是正常的。可以使用 `CONCURRENTLY` 選項（已在腳本中使用）避免鎖表。

## 📚 相關文件

- [實施總結](./docs/IMPLEMENTATION_SUMMARY.md)
- [Redis Cache 策略](./docs/REDIS_CACHE_STRATEGY.md)
- [PgBouncer 設定指南](./docs/PGBOUNCER_SETUP.md)
- [服務條款](./docs/legal/TERMS_OF_SERVICE.md)
- [隱私權政策](./docs/legal/PRIVACY_POLICY.md)

## 🆘 支援

如有任何問題，請參考：
- 資料庫問題：`scripts/slow_query_analysis.sql`
- Cache 問題：`docs/REDIS_CACHE_STRATEGY.md`
- 連線池問題：`docs/PGBOUNCER_SETUP.md`

---

**最後更新：** 2025年1月

