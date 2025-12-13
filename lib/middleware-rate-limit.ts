/**
 * Rate Limit Middleware for API Routes
 * 
 * 提供統一的速率限制中間件，可套用到任何 API route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { RedisRateLimiter, RateLimitConfig, RateLimitPresets } from './rate-limit-redis';

export interface RateLimitOptions {
  config?: RateLimitConfig;
  preset?: keyof typeof RateLimitPresets;
  endpoint?: string;
}

/**
 * 速率限制中間件
 * 
 * 使用方式：
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await withRateLimit(request, { preset: 'AUTH' });
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 *   // ... 處理請求
 * }
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): Promise<{
  allowed: boolean;
  response?: NextResponse;
  remaining?: number;
  resetTime?: number;
}> {
  // 獲取配置
  const config = options.config || 
    (options.preset ? RateLimitPresets[options.preset] : RateLimitPresets.GENERAL);

  // 獲取用戶 ID（如果已登入）
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;

  // 檢查速率限制
  const result = await RedisRateLimiter.check(
    request,
    userId,
    config,
    options.endpoint || request.nextUrl.pathname
  );

  if (!result.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: '請求過於頻繁，請稍後再試',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
          },
        }
      ),
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

