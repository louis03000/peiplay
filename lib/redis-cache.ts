/**
 * Redis Cache Layer for PeiPlay
 * 
 * 使用 @upstash/redis（HTTP 模式）適用於 Vercel Serverless
 * 
 * 提供統一的 Redis cache 介面，包含：
 * - Cache 讀寫操作
 * - Cache invalidation 策略
 * - TTL 管理
 * - Cache key 命名規範
 * 
 * 注意：需要設定 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN 環境變數
 */

import { Redis } from '@upstash/redis';

// Redis client singleton
let redisClient: Redis | null = null;

/**
 * 初始化 Redis 客戶端（Upstash HTTP 模式）
 */
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.error('❌ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set');
    console.error('❌ Please set these in Vercel Environment Variables');
    console.error('❌ Get them from Upstash Dashboard → REST tab');
    return null;
  }

  try {
    console.error('✅ Creating Upstash Redis client (HTTP mode)');
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    return redisClient;
  } catch (error: any) {
    console.error('❌ Failed to create Upstash Redis client:', error);
    return null;
  }
}

/**
 * Cache TTL 常數（秒）
 */
export const CacheTTL = {
  SHORT: 120,   // 2 分鐘
  MEDIUM: 300,  // 5 分鐘
  LONG: 1800,   // 30 分鐘
} as const;

/**
 * Cache Invalidation 工具
 */
export const CacheInvalidation = {
  /**
   * 當 Partner 更新時，清除相關 cache
   */
  async onPartnerUpdate(partnerId: string): Promise<void> {
    try {
      const patterns = [
        `partners:*`,
        `partner:${partnerId}:*`,
        `stats:*`,
      ];
      
      for (const pattern of patterns) {
        await Cache.deletePattern(pattern);
      }
    } catch (error: any) {
      console.error('Cache invalidation error:', error);
    }
  },
} as const;

/**
 * Cache Key 命名規範
 */
export const CacheKeys = {
  // User stats
  stats: {
    user: (userId: string) => `stats:user:${userId}`,
    platform: () => `stats:platform`,
  },

  // User info
  user: {
    role: (userId: string) => `user:${userId}:role`,
    partnerInfo: (userId: string) => `user:${userId}:partner`,
  },

  // Chat system
  chat: {
    meta: (roomId: string) => `chat:meta:${roomId}`,
    // ✅ 改用 List，不需要 limit 參數（在 lrange 時指定）
    messages: (roomId: string) => `chat:room:${roomId}:messages`,
    rooms: (userId: string) => `chat:rooms:${userId}`,
  },

  // Partners
  partners: {
    detail: (partnerId: string) => `partner:${partnerId}`,
    list: (params?: any) => {
      if (!params) return `partners:list`;
      // 將物件轉換為穩定的字串 key
      const sorted = Object.keys(params).sort().map(k => `${k}:${params[k]}`).join('|');
      return `partners:list:${sorted}`;
    },
    ranking: () => `partners:ranking`,
    averageRating: (partnerId: string) => `partner:${partnerId}:rating`,
  },

  // Reviews
  reviews: {
    partner: (partnerId: string) => `reviews:partner:${partnerId}`,
    public: () => `reviews:public`,
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
    if (!client) {
      console.error(`⚠️  Cache.get(${key}): Redis client not available`);
      return null;
    }

    try {
      const value = await client.get(key);
      if (value === null || value === undefined) {
        console.error(`📭 Cache.get(${key}): MISS (no value found)`);
        return null;
      }
      console.error(`✅ Cache.get(${key}): HIT (value found)`);
      // Upstash 已經自動處理 JSON，但我們還是確保類型正確
      return value as T;
    } catch (error: any) {
      console.error(`❌ Cache get error for key ${key}:`, error);
      console.error(`❌ Error message:`, error.message);
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
    if (!client) {
      console.error(`⚠️  Cache.set(${key}): Redis client not available`);
      return false;
    }

    try {
      const valueStr = JSON.stringify(value);
      console.error(`💾 Cache.set(${key}): Setting value (size: ${valueStr.length} bytes, TTL: ${ttlSeconds}s)`);
      
      // Upstash Redis 使用 setEx 方法，參數順序：key, seconds, value
      await client.set(key, value, { ex: ttlSeconds });
      
      // ✅ 驗證是否真的寫入了
      const verify = await client.get(key);
      if (verify !== null && verify !== undefined) {
        console.error(`✅ Cache.set(${key}): Success and verified (TTL: ${ttlSeconds}s)`);
      } else {
        console.error(`❌ Cache.set(${key}): Set succeeded but verification failed (value not found)`);
      }
      
      return true;
    } catch (error: any) {
      console.error(`❌ Cache set error for key ${key}:`, error);
      console.error(`❌ Error message:`, error.message);
      console.error(`❌ Error stack:`, error.stack);
      return false;
    }
  }

  /**
   * 刪除 cache
   */
  static async delete(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) {
      console.error(`⚠️  Cache.delete(${key}): Redis client not available`);
      return false;
    }

    try {
      await client.del(key);
      console.error(`✅ Cache.delete(${key}): Success`);
      return true;
    } catch (error: any) {
      console.error(`❌ Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * 批量刪除符合 pattern 的 keys
   * 
   * ⚠️ DEPRECATED: 在 Upstash HTTP Redis 中，keys() 會掃描整個 keyspace，非常慢（4-6秒）
   * 禁止在 GET API 中使用，只能在 POST/PATCH/webhook/cron 中使用
   * 建議改用版本號 key 或直接覆寫的方式
   */
  static async deletePattern(pattern: string): Promise<number> {
    const client = getRedisClient();
    if (!client) {
      console.error(`⚠️  Cache.deletePattern(${pattern}): Redis client not available`);
      return 0;
    }

    try {
      // ⚠️ 警告：keys() 在 Upstash HTTP Redis 中會掃描整個 keyspace，非常慢
      console.warn(`⚠️  Cache.deletePattern(${pattern}): Using keys() is slow in Upstash HTTP Redis`);
      const keys = await client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      
      // 批量刪除
      const deleted = await client.del(...keys);
      console.error(`✅ Cache.deletePattern(${pattern}): Deleted ${deleted} keys`);
      return deleted;
    } catch (error: any) {
      console.error(`❌ Cache deletePattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Redis List 操作：從左邊推入（用於聊天訊息，新訊息在左邊）
   */
  static async listPush(key: string, value: string | object): Promise<number> {
    const client = getRedisClient();
    if (!client) {
      console.error(`⚠️  Cache.listPush(${key}): Redis client not available`);
      return 0;
    }

    try {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      const length = await client.lpush(key, valueStr);
      console.error(`✅ Cache.listPush(${key}): Pushed, list length: ${length}`);
      return length;
    } catch (error: any) {
      console.error(`❌ Cache listPush error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Redis List 操作：從右邊推入（用於回填歷史訊息）
   */
  static async listPushRight(key: string, ...values: (string | object)[]): Promise<number> {
    const client = getRedisClient();
    if (!client) {
      console.error(`⚠️  Cache.listPushRight(${key}): Redis client not available`);
      return 0;
    }

    try {
      const valueStrs = values.map(v => typeof v === 'string' ? v : JSON.stringify(v));
      const length = await client.rpush(key, ...valueStrs);
      console.error(`✅ Cache.listPushRight(${key}): Pushed ${valueStrs.length} items, list length: ${length}`);
      return length;
    } catch (error: any) {
      console.error(`❌ Cache listPushRight error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Redis List 操作：獲取範圍內的元素（用於讀取聊天訊息）
   * @param key List key
   * @param start 起始索引（0-based，0 是最新的）
   * @param stop 結束索引（包含）
   * @returns 解析後的物件陣列
   */
  static async listRange<T = any>(key: string, start: number = 0, stop: number = -1): Promise<T[]> {
    const client = getRedisClient();
    if (!client) {
      console.error(`⚠️  Cache.listRange(${key}): Redis client not available`);
      return [];
    }

    try {
      const rawValues = await client.lrange(key, start, stop);
      if (!rawValues || rawValues.length === 0) {
        console.error(`📭 Cache.listRange(${key}): MISS (empty list)`);
        return [];
      }

      const parsed = rawValues.map((v: string) => {
        try {
          return JSON.parse(v);
        } catch {
          // 如果解析失敗，返回原始值
          return v;
        }
      }) as T[];

      console.error(`✅ Cache.listRange(${key}): HIT (${parsed.length} items)`);
      return parsed;
    } catch (error: any) {
      console.error(`❌ Cache listRange error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Redis List 操作：修剪列表，只保留指定範圍（用於限制聊天訊息數量）
   * @param key List key
   * @param start 起始索引
   * @param stop 結束索引（通常是 N-1，例如 0-49 保留前 50 個）
   */
  static async listTrim(key: string, start: number = 0, stop: number = 49): Promise<boolean> {
    const client = getRedisClient();
    if (!client) {
      console.error(`⚠️  Cache.listTrim(${key}): Redis client not available`);
      return false;
    }

    try {
      await client.ltrim(key, start, stop);
      console.error(`✅ Cache.listTrim(${key}): Trimmed to [${start}, ${stop}]`);
      return true;
    } catch (error: any) {
      console.error(`❌ Cache listTrim error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * 獲取 cache 值，如果不存在則執行回調函數並設置 cache
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss，執行 factory 函數獲取數據
    const value = await factory();
    
    // 設置 cache（不等待完成，避免阻塞）
    this.set(key, value, ttlSeconds).catch((error: any) => {
      console.error(`⚠️ Failed to set cache for ${key}:`, error);
    });

    return value;
  }
}
