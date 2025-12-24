/**
 * Cache 管理工具
 * 
 * 設計原則：
 * 1. 所有 cache key 必須使用命名空間
 * 2. 禁止使用簡短 key（例如 'bookings'）
 * 3. cache set / get 必須包成 util function
 */

// ========== Cache Key 命名空間 ==========
export const CACHE_NAMESPACES = {
  BOOKING: 'booking',
  CHAT: 'chat',
  AUTH: 'auth',
  PARTNER: 'partner',
  SCHEDULE: 'schedule',
  USER: 'user',
} as const

// ========== Cache Key 生成器 ==========
/**
 * 生成帶命名空間的 cache key
 * 
 * @example
 * getCacheKey(CACHE_NAMESPACES.BOOKING, 'user', userId) 
 * // => 'booking:user:abc123'
 */
export function getCacheKey(
  namespace: string,
  ...parts: (string | number | undefined)[]
): string {
  const validParts = parts.filter((p) => p !== undefined && p !== null && p !== '')
  return `${namespace}:${validParts.join(':')}`
}

// ========== Memory Cache（簡單實現）==========
/**
 * ⚠️ 注意：這是簡單的 memory cache
 * 在 Vercel Serverless 環境中，每個 function 實例有獨立的 memory
 * 如果需要跨實例共享，應使用 Redis
 */

class MemoryCache {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map()

  set(key: string, value: any, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiresAt })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // 清理過期項目
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// ========== 單例 Cache 實例 ==========
const memoryCache = new MemoryCache()

// 定期清理過期項目
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    memoryCache.cleanup()
  }, 60000) // 每分鐘清理一次
}

// ========== Cache 操作函數 ==========
/**
 * 設置 cache（帶命名空間）
 */
export function setCache(
  namespace: string,
  key: string,
  value: any,
  ttlSeconds: number = 300
): void {
  const fullKey = getCacheKey(namespace, key)
  memoryCache.set(fullKey, value, ttlSeconds)
}

/**
 * 獲取 cache（帶命名空間）
 */
export function getCache<T>(namespace: string, key: string): T | null {
  const fullKey = getCacheKey(namespace, key)
  return memoryCache.get<T>(fullKey)
}

/**
 * 刪除 cache（帶命名空間）
 */
export function deleteCache(namespace: string, key: string): void {
  const fullKey = getCacheKey(namespace, key)
  memoryCache.delete(fullKey)
}

/**
 * 清除整個命名空間的 cache
 */
export function clearNamespace(namespace: string): void {
  // 簡單實現：遍歷所有 key 並刪除匹配的
  // 注意：這在大量 key 時可能較慢，實際應使用 Redis 的 pattern delete
  const prefix = `${namespace}:`
  for (const key of memoryCache['cache'].keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}

// ========== 特定命名空間的快捷函數 ==========
export const bookingCache = {
  set: (key: string, value: any, ttl?: number) => 
    setCache(CACHE_NAMESPACES.BOOKING, key, value, ttl),
  get: <T>(key: string) => getCache<T>(CACHE_NAMESPACES.BOOKING, key),
  delete: (key: string) => deleteCache(CACHE_NAMESPACES.BOOKING, key),
  clear: () => clearNamespace(CACHE_NAMESPACES.BOOKING),
}

export const chatCache = {
  set: (key: string, value: any, ttl?: number) => 
    setCache(CACHE_NAMESPACES.CHAT, key, value, ttl),
  get: <T>(key: string) => getCache<T>(CACHE_NAMESPACES.CHAT, key),
  delete: (key: string) => deleteCache(CACHE_NAMESPACES.CHAT, key),
  clear: () => clearNamespace(CACHE_NAMESPACES.CHAT),
}

export const authCache = {
  set: (key: string, value: any, ttl?: number) => 
    setCache(CACHE_NAMESPACES.AUTH, key, value, ttl),
  get: <T>(key: string) => getCache<T>(CACHE_NAMESPACES.AUTH, key),
  delete: (key: string) => deleteCache(CACHE_NAMESPACES.AUTH, key),
  clear: () => clearNamespace(CACHE_NAMESPACES.AUTH),
}

export const partnerCache = {
  set: (key: string, value: any, ttl?: number) => 
    setCache(CACHE_NAMESPACES.PARTNER, key, value, ttl),
  get: <T>(key: string) => getCache<T>(CACHE_NAMESPACES.PARTNER, key),
  delete: (key: string) => deleteCache(CACHE_NAMESPACES.PARTNER, key),
  clear: () => clearNamespace(CACHE_NAMESPACES.PARTNER),
}

export const scheduleCache = {
  set: (key: string, value: any, ttl?: number) => 
    setCache(CACHE_NAMESPACES.SCHEDULE, key, value, ttl),
  get: <T>(key: string) => getCache<T>(CACHE_NAMESPACES.SCHEDULE, key),
  delete: (key: string) => deleteCache(CACHE_NAMESPACES.SCHEDULE, key),
  clear: () => clearNamespace(CACHE_NAMESPACES.SCHEDULE),
}

export const userCache = {
  set: (key: string, value: any, ttl?: number) => 
    setCache(CACHE_NAMESPACES.USER, key, value, ttl),
  get: <T>(key: string) => getCache<T>(CACHE_NAMESPACES.USER, key),
  delete: (key: string) => deleteCache(CACHE_NAMESPACES.USER, key),
  clear: () => clearNamespace(CACHE_NAMESPACES.USER),
}

