# Redis Cache 策略文件

## 概述

PeiPlay 使用 Redis 作為快取層，以提升 API 響應速度和減少資料庫負載。

## Cache Key 命名規範

所有 cache key 遵循以下命名規範：
- 格式：`{resource}:{type}:{identifier}`
- 範例：`partners:detail:abc123`, `bookings:user:xyz789`

## Cache 策略

### 1. Partners（陪玩者）

#### Cache Keys
- `partners:list:{params}` - 夥伴列表（根據查詢參數）
- `partners:detail:{id}` - 單一夥伴詳情
- `partners:verified` - 已驗證夥伴列表
- `partners:homepage` - 首頁推薦夥伴

#### TTL
- 列表：5 分鐘（MEDIUM）
- 詳情：10 分鐘（MEDIUM）
- 首頁：2 分鐘（SHORT）

#### Invalidation
當以下事件發生時，清除相關 cache：
- Partner 資料更新
- Partner 驗證狀態變更
- Partner 狀態變更（APPROVED/REJECTED）
- 新增 Review

### 2. Bookings（預約）

#### Cache Keys
- `bookings:user:{userId}` - 用戶的預約列表
- `bookings:user:{userId}:{status}` - 特定狀態的預約
- `bookings:partner:{partnerId}` - 陪玩者的預約列表

#### TTL
- 用戶預約：2 分鐘（SHORT）
- 陪玩者預約：2 分鐘（SHORT）

#### Invalidation
當以下事件發生時，清除相關 cache：
- 建立新預約
- 預約狀態變更
- 預約取消或完成

### 3. KYC / Verification（驗證）

#### Cache Keys
- `kyc:user:{userId}` - 用戶 KYC 狀態
- `kyc:pending` - 待審核 KYC 列表
- `verification:partner:{partnerId}` - 陪玩者驗證狀態
- `verification:pending` - 待審核驗證列表

#### TTL
- KYC 狀態：10 分鐘（MEDIUM）
- 待審核列表：1 分鐘（SHORT）

#### Invalidation
當以下事件發生時，清除相關 cache：
- KYC 狀態變更
- 驗證狀態變更
- 審核完成

### 4. Reviews（評價）

#### Cache Keys
- `reviews:partner:{partnerId}` - 陪玩者評價列表

#### TTL
- 評價列表：15 分鐘（MEDIUM）

#### Invalidation
當以下事件發生時，清除相關 cache：
- 新增評價
- 評價被審核

## Cache Invalidation 模式

### 1. Cache-Aside（Lazy Loading）
```typescript
// 讀取時檢查 cache，沒有則從資料庫載入並寫入 cache
const data = await Cache.getOrSet(key, () => fetchFromDB(), TTL);
```

### 2. Write-Through
```typescript
// 寫入時同時更新 cache 和資料庫
await updateDB(data);
await Cache.set(key, data, TTL);
```

### 3. Write-Back（Write-Behind）
```typescript
// 先寫入 cache，異步寫入資料庫（不適用於關鍵資料）
await Cache.set(key, data, TTL);
await queueDBUpdate(data);
```

## 使用範例

### API Route 中使用 Cache

```typescript
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const partnerId = searchParams.get('id');

  if (partnerId) {
    // 使用 cache
    const partner = await Cache.getOrSet(
      CacheKeys.partners.detail(partnerId),
      async () => {
        return await db.partner.findUnique({
          where: { id: partnerId },
        });
      },
      CacheTTL.MEDIUM
    );

    return NextResponse.json(partner);
  }

  // 列表查詢
  const params = Object.fromEntries(searchParams);
  const partners = await Cache.getOrSet(
    CacheKeys.partners.list(params),
    async () => {
      return await db.partner.findMany({ /* ... */ });
    },
    CacheTTL.MEDIUM
  );

  return NextResponse.json(partners);
}
```

### 更新時清除 Cache

```typescript
import { CacheInvalidation } from '@/lib/redis-cache';

export async function PATCH(request: NextRequest) {
  // 更新資料
  const partner = await db.partner.update({
    where: { id: partnerId },
    data: updateData,
  });

  // 清除相關 cache
  await CacheInvalidation.onPartnerUpdate(partnerId);

  return NextResponse.json(partner);
}
```

## 監控與維護

### 1. Cache Hit Rate
定期檢查 cache hit rate，目標 > 80%

### 2. Cache Size
監控 Redis 記憶體使用，避免 OOM

### 3. Key Expiration
定期檢查過期 key，確保 TTL 設定合理

### 4. 除錯
使用 Redis CLI 檢查 cache：
```bash
redis-cli
> KEYS partners:*
> GET partners:detail:abc123
> TTL partners:detail:abc123
```

## 注意事項

1. **不要 cache 敏感資料**：密碼、token 等不應放入 cache
2. **TTL 設定**：根據資料變動頻率調整 TTL
3. **Cache Stampede**：使用 lock 機制避免大量請求同時擊中 cache miss
4. **Memory Management**：設定 Redis maxmemory 和 eviction policy
5. **Fallback**：Redis 故障時應能正常運作（graceful degradation）

## 環境變數

```env
REDIS_URL=redis://localhost:6379
# 或使用 Upstash Redis
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

## 相關文件

- [Redis Cache Implementation](./lib/redis-cache.ts)
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION_GUIDE.md)

