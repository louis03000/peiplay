/**
 * Redis-based Rate Limiting for PeiPlay
 * 
 * 實作真正的速率限制，支援多實例部署
 * - 使用 Redis 儲存計數器
 * - 支援 IP 和 UserID 雙重限制
 * - 自動寫入 SecurityLog
 */

import { NextRequest } from 'next/server';
import { getRedisClient } from './redis-cache';
import { prisma } from './prisma';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier: 'ip' | 'userId' | 'both';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Redis Key 設計
 * 
 * 格式: rate_limit:{type}:{identifier}:{endpoint?}
 * 
 * 範例:
 * - rate_limit:ip:192.168.1.1:api/auth/login
 * - rate_limit:user:user123:api/bookings
 * - rate_limit:ip:192.168.1.1 (一般 API)
 */
function getRateLimitKey(
  type: 'ip' | 'user',
  identifier: string,
  endpoint?: string
): string {
  const base = `rate_limit:${type}:${identifier}`;
  return endpoint ? `${base}:${endpoint}` : base;
}

/**
 * 獲取客戶端 IP
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
  return ip;
}

/**
 * Redis Rate Limiter 類別
 */
export class RedisRateLimiter {
  /**
   * 檢查速率限制
   */
  static async check(
    request: NextRequest,
    userId: string | null,
    config: RateLimitConfig,
    endpoint?: string
  ): Promise<RateLimitResult> {
    const client = getRedisClient();
    const ip = getClientIP(request);
    const now = Date.now();
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    // 如果沒有 Redis，降級為允許（但記錄警告）
    if (!client) {
      console.warn('⚠️  Redis not available, rate limiting disabled');
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
        limit: config.maxRequests,
      };
    }

    let result: RateLimitResult | null = null;

    // 根據配置檢查 IP 或 UserID
    if (config.identifier === 'ip' || config.identifier === 'both') {
      result = await this.checkLimit(
        client,
        'ip',
        ip,
        config,
        endpoint,
        now,
        windowSeconds
      );
      
      if (!result.allowed) {
        // 記錄到 SecurityLog
        await this.logRateLimitExceeded('ip', ip, endpoint, request);
        return result;
      }
    }

    if (config.identifier === 'userId' || config.identifier === 'both') {
      if (!userId) {
        // 需要 userId 但沒有提供，視為未認證請求
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetTime: now + config.windowMs,
          limit: config.maxRequests,
        };
      }

      const userResult = await this.checkLimit(
        client,
        'user',
        userId,
        config,
        endpoint,
        now,
        windowSeconds
      );

      if (!userResult.allowed) {
        // 記錄到 SecurityLog
        await this.logRateLimitExceeded('user', userId, endpoint, request, userId);
        return userResult;
      }

      // 如果同時檢查 IP 和 UserID，取較嚴格的結果
      if (result && userResult.remaining < result.remaining) {
        result = userResult;
      } else if (!result) {
        result = userResult;
      }
    }

    return result || {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      limit: config.maxRequests,
    };
  }

  /**
   * 檢查單一限制（IP 或 UserID）
   */
  private static async checkLimit(
    client: any,
    type: 'ip' | 'user',
    identifier: string,
    config: RateLimitConfig,
    endpoint: string | undefined,
    now: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = getRateLimitKey(type, identifier, endpoint);
    const resetTime = now + config.windowMs;

    try {
      // 使用 Redis INCR 和 EXPIRE
      // 這是一個原子操作，確保多實例環境下的正確性
      const current = await client.incr(key);
      
      // 如果是第一次請求，設置過期時間
      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, config.maxRequests - current);
      const allowed = current <= config.maxRequests;

      return {
        allowed,
        remaining,
        resetTime,
        limit: config.maxRequests,
      };
    } catch (error) {
      console.error('❌ Redis rate limit error:', error);
      // Redis 錯誤時，為了可用性，允許請求（但記錄警告）
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime,
        limit: config.maxRequests,
      };
    }
  }

  /**
   * 記錄速率限制觸發事件到 SecurityLog
   */
  private static async logRateLimitExceeded(
    type: 'ip' | 'user',
    identifier: string,
    endpoint: string | undefined,
    request: NextRequest,
    userId?: string
  ): Promise<void> {
    try {
      const ip = getClientIP(request);
      const userAgent = request.headers.get('user-agent') || 'unknown';
      
      await prisma.securityLog.create({
        data: {
          userId: userId || null, // userId 可為 null
          eventType: 'RATE_LIMIT_EXCEEDED',
          details: JSON.stringify({
            type,
            identifier,
            endpoint: endpoint || request.nextUrl.pathname,
            ip,
            userAgent,
            timestamp: new Date().toISOString(),
          }),
          ipAddress: ip,
          userAgent,
        },
      });
    } catch (error) {
      // 記錄失敗不應該影響主要流程
      console.error('❌ Failed to log rate limit event:', error);
    }
  }

  /**
   * 重置速率限制（用於測試或手動重置）
   */
  static async reset(
    type: 'ip' | 'user',
    identifier: string,
    endpoint?: string
  ): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const key = getRateLimitKey(type, identifier, endpoint);
      await client.del(key);
      return true;
    } catch (error) {
      console.error('❌ Failed to reset rate limit:', error);
      return false;
    }
  }
}

/**
 * 預設速率限制配置
 */
export const RateLimitPresets = {
  // 登入/註冊：5 次 / 分鐘
  AUTH: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 分鐘
    identifier: 'both' as const, // IP + UserID
  },

  // 一般 API：60 次 / 分鐘
  GENERAL: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 分鐘
    identifier: 'ip' as const,
  },

  // 敏感操作：10 次 / 15 分鐘
  SENSITIVE: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 分鐘
    identifier: 'both' as const,
  },

  // 註冊：3 次 / 小時
  REGISTER: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 小時
    identifier: 'ip' as const,
  },
} as const;

