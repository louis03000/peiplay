/**
 * Redis Cache Layer for PeiPlay
 * 
 * 提供統一的 Redis cache 介面，包含：
 * - Cache 讀寫操作
 * - Cache invalidation 策略
 * - TTL 管理
 * - Cache key 命名規範
 * 
 * 注意：如果未安裝 redis 套件，所有 cache 操作將自動降級為無操作（no-op）
 */

// Redis client singleton
let redisClient: any = null;
let redisModule: any = null;

/**
 * 動態載入 Redis 模組（如果可用）
 */
function loadRedisModule() {
  if (redisModule) {
    return redisModule;
  }

  try {
    redisModule = require('redis');
    return redisModule;
  } catch (error) {
    // Redis 未安裝，返回 null
    return null;
  }
}

/**
 * 初始化 Redis 客戶端
 */
export function getRedisClient(): any | null {
  if (redisClient) {
    return redisClient;
  }

  const redis = loadRedisModule();
  if (!redis) {
    // Redis 未安裝，靜默返回 null
    return null;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('⚠️  REDIS_URL not set, cache will be disabled');
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err: any) => {
      console.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected (external Redis, not in-memory)');
    });

    // 非同步連接（不阻塞）
    redisClient.connect().catch((err: any) => {
      console.error('❌ Redis connection failed:', err);
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.error('❌ Failed to create Redis client:', error);
    return null;
  }
}

/**
 * Cache Key 命名規範
 */
export const CacheKeys = {
  // Partners
  partners: {
    list: (params: Record<string, any>) => {
      const key = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
      return `partners:list:${key}`;
    },
    detail: (id: string) => `partners:detail:${id}`,
    verified: () => 'partners:verified',
    homepage: () => 'partners:homepage',
    ranking: () => 'partners:ranking',
  },

  // Bookings
  bookings: {
    user: (userId: string, status?: string) => 
      `bookings:user:${userId}${status ? `:${status}` : ''}`,
    partner: (partnerId: string, status?: string) => 
      `bookings:partner:${partnerId}${status ? `:${status}` : ''}`,
  },

  // KYC
  kyc: {
    user: (userId: string) => `kyc:user:${userId}`,
    pending: () => 'kyc:pending',
  },

  // Partner Verification
  verification: {
    partner: (partnerId: string) => `verification:partner:${partnerId}`,
    pending: () => 'verification:pending',
  },

  // Reviews
  reviews: {
    partner: (partnerId: string) => `reviews:partner:${partnerId}`,
  },

  // Stats
  stats: {
    platform: () => 'stats:platform',
    user: (userId: string) => `stats:user:${userId}`,
  },

  // Chat (正式聊天室)
  chat: {
    meta: (roomId: string) => `chat:meta:${roomId}`,
    messages: (roomId: string, limit: number = 10) => `chat:messages:${roomId}:${limit}`,
    rooms: (userId: string) => `chat:rooms:${userId}`,
  },

  // Pre-Chat (預聊系統)
  preChat: {
    meta: (roomId: string) => `prechat:meta:${roomId}`,
  },
} as const;

/**
 * Cache 操作類別
 */
export class Cache {
  /**
   * 獲取 cache 值
   */
  static async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`❌ Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 設置 cache 值
   */
  static async set(
    key: string,
    value: any,
    ttlSeconds: number = 300 // 預設 5 分鐘
  ): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * 刪除 cache
   */
  static async delete(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * 批量刪除符合 pattern 的 cache
   */
  static async deletePattern(pattern: string): Promise<number> {
    const client = getRedisClient();
    if (!client) return 0;

    try {
      const keys = await client.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await client.del(keys);
      return deleted;
    } catch (error) {
      console.error(`❌ Cache deletePattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * 獲取或設置 cache（cache-aside pattern）
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

/**
 * Cache Invalidation 策略
 */
export class CacheInvalidation {
  /**
   * 當 Partner 更新時，清除相關 cache
   */
  static async onPartnerUpdate(partnerId: string) {
    await Promise.all([
      Cache.delete(CacheKeys.partners.detail(partnerId)),
      Cache.deletePattern('partners:list:*'),
      Cache.delete(CacheKeys.partners.homepage()),
      Cache.delete(CacheKeys.partners.verified()),
      Cache.delete(CacheKeys.verification.partner(partnerId)),
    ]);
  }

  /**
   * 當 Partner 驗證狀態變更時
   */
  static async onPartnerVerificationUpdate(partnerId: string) {
    await Promise.all([
      Cache.delete(CacheKeys.partners.detail(partnerId)),
      Cache.delete(CacheKeys.verification.partner(partnerId)),
      Cache.delete(CacheKeys.verification.pending()),
      Cache.delete(CacheKeys.partners.homepage()),
      Cache.delete(CacheKeys.partners.verified()),
      Cache.deletePattern('partners:list:*'),
    ]);
  }

  /**
   * 當 Booking 更新時
   */
  static async onBookingUpdate(bookingId: string, userId?: string, partnerId?: string) {
    const promises: Promise<boolean | number>[] = [
      Cache.deletePattern('bookings:user:*'),
      Cache.deletePattern('bookings:partner:*'),
    ];

    if (userId) {
      promises.push(Cache.delete(CacheKeys.bookings.user(userId)));
    }
    if (partnerId) {
      promises.push(Cache.delete(CacheKeys.bookings.partner(partnerId)));
    }

    await Promise.all(promises);
  }

  /**
   * 當 KYC 狀態變更時
   */
  static async onKYCUpdate(userId: string) {
    await Promise.all([
      Cache.delete(CacheKeys.kyc.user(userId)),
      Cache.delete(CacheKeys.kyc.pending()),
    ]);
  }

  /**
   * 當 Review 新增時
   */
  static async onReviewCreate(partnerId: string) {
    await Promise.all([
      Cache.delete(CacheKeys.reviews.partner(partnerId)),
      Cache.delete(CacheKeys.partners.detail(partnerId)),
      Cache.deletePattern('partners:list:*'),
    ]);
  }
}

/**
 * Cache 裝飾器（用於 API routes）
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttlSeconds: number = 300
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = (async function (this: any, ...args: Parameters<T>) {
      const key = keyGenerator(...args);
      const cached = await Cache.get(key);
      if (cached !== null) {
        return cached;
      }

      const result = await method.apply(this, args);
      await Cache.set(key, result, ttlSeconds);
      return result;
    }) as T;
  };
}

/**
 * 預設 TTL 設定（秒）
 */
export const CacheTTL = {
  SHORT: 60,        // 1 分鐘（高頻變動資料）
  MEDIUM: 300,      // 5 分鐘（一般資料）
  LONG: 1800,       // 30 分鐘（較少變動資料）
  VERY_LONG: 3600,  // 1 小時（靜態資料）
} as const;

