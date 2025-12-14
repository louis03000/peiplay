/**
 * Rate Limiting for Chat Messages
 * 使用 Redis token bucket 算法
 */

import { NextRequest, NextResponse } from 'next/server';
import { Cache } from './redis-cache';

interface RateLimitOptions {
  windowMs: number;      // 時間窗口（毫秒）
  maxRequests: number;   // 最大請求數
  keyGenerator: (req: NextRequest, userId?: string) => string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Rate limit 檢查
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions,
  userId?: string
): Promise<RateLimitResult> {
  const key = options.keyGenerator(req, userId);
  const cacheKey = `rate:${key}`;

  // 獲取當前計數
  const current = await Cache.get<number>(cacheKey) || 0;

  if (current >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + options.windowMs,
    };
  }

  // 增加計數
  const ttlSeconds = Math.ceil(options.windowMs / 1000);
  await Cache.set(cacheKey, current + 1, ttlSeconds);

  return {
    allowed: true,
    remaining: options.maxRequests - current - 1,
    resetTime: Date.now() + options.windowMs,
  };
}

/**
 * Rate limit 中間件（用於 API routes）
 */
export async function withRateLimit(
  req: NextRequest,
  options: RateLimitOptions,
  userId?: string
): Promise<NextResponse | null> {
  const limit = await rateLimit(req, options, userId);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: '請求過於頻繁，請稍後再試',
        code: 'RATE_LIMIT_EXCEEDED',
        resetTime: limit.resetTime,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': limit.resetTime.toString(),
          'Retry-After': Math.ceil((limit.resetTime - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // 允許請求繼續
}
