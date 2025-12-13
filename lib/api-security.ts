import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SecurityEnhanced } from '@/lib/security-enhanced';
import { RedisRateLimiter, RateLimitConfig, RateLimitPresets } from '@/lib/rate-limit-redis';

export class APISecurity {
  // 檢查 API 請求的頻率限制（使用 Redis）
  static async checkRateLimit(
    request: NextRequest,
    userId: string | null,
    config: RateLimitConfig,
    endpoint?: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number; limit: number }> {
    return await RedisRateLimiter.check(request, userId, config, endpoint);
  }

  // 驗證 CSRF 令牌（使用新的 CSRF 防護機制）
  static async validateCSRFToken(request: NextRequest): Promise<{
    valid: boolean;
    response?: NextResponse;
  }> {
    const { validateCSRF } = await import('./csrf-protection');
    return await validateCSRF(request);
  }

  // 檢查請求來源
  static validateOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    // 允許的來源
    const allowedOrigins = [
      'http://localhost:3000',
      'https://peiplay.vercel.app',
      'https://www.peiplay.vercel.app',
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      return true;
    }
    
    if (referer) {
      const refererUrl = new URL(referer);
      return allowedOrigins.some(allowed => 
        refererUrl.origin === allowed || 
        refererUrl.hostname.endsWith('.peiplay.vercel.app')
      );
    }
    
    return false;
  }

  // 添加安全標頭
  static addSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // HSTS (僅在 HTTPS 環境下)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    return response;
  }

  // 完整的 API 安全檢查
  static async secureAPIRequest(
    request: NextRequest,
    options: {
      requireAuth?: boolean;
      requireCSRF?: boolean;
      rateLimit?: {
        maxRequests: number;
        windowMs: number;
      };
      logSecurity?: boolean;
    } = {}
  ): Promise<{ 
    allowed: boolean; 
    response?: NextResponse; 
    session?: any;
    identifier?: string;
  }> {
    const {
      requireAuth = true,
      requireCSRF = false,
      rateLimit = { maxRequests: 100, windowMs: 15 * 60 * 1000 },
      logSecurity = true
    } = options;

    // 1. 檢查來源
    if (!this.validateOrigin(request)) {
      if (logSecurity) {
        console.warn('🚨 可疑請求來源:', {
          origin: request.headers.get('origin'),
          referer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for'),
        });
      }
      
      return {
        allowed: false,
        response: NextResponse.json(
          { error: '不允許的請求來源' },
          { status: 403 }
        )
      };
    }

    // 2. 檢查 CSRF 令牌
    if (requireCSRF) {
      const csrfResult = await this.validateCSRFToken(request);
      if (!csrfResult.valid) {
        return {
          allowed: false,
          response: csrfResult.response,
        };
      }
    }

    // 3. 檢查身份驗證（先獲取 session，用於速率限制）
    let session = null;
    if (requireAuth) {
      session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return {
          allowed: false,
          response: NextResponse.json(
            { error: '需要身份驗證' },
            { status: 401 }
          )
        };
      }
    }

    // 4. 檢查頻率限制
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userId = session?.user?.id || null;
    const rateLimitConfig: RateLimitConfig = {
      maxRequests: rateLimit.maxRequests,
      windowMs: rateLimit.windowMs,
      identifier: userId ? 'both' : 'ip', // 有 userId 時同時檢查 IP 和 UserID
    };
    const rateLimitCheck = await this.checkRateLimit(
      request,
      userId,
      rateLimitConfig,
      request.nextUrl.pathname
    );

    if (!rateLimitCheck.allowed) {
      return {
        allowed: false,
        response: NextResponse.json(
          { 
            error: '請求過於頻繁',
            retryAfter: Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000)
          },
          { status: 429 }
        )
      };
    }

    // 5. 記錄安全事件（如果需要）
    if (logSecurity && session?.user?.id) {
      await SecurityEnhanced.logSecurityEvent(
        session.user.id,
        'LOGIN_ATTEMPT',
        {
          event: 'API_REQUEST',
          ipAddress,
          userAgent: request.headers.get('user-agent') || 'unknown',
          endpoint: request.nextUrl.pathname,
          method: request.method,
        }
      );
    }

    return {
      allowed: true,
      session,
      identifier: ipAddress,
    };
  }

  // 創建安全的 API 響應
  static createSecureResponse(data: any, status: number = 200): NextResponse {
    const response = NextResponse.json(data, { status });
    return this.addSecurityHeaders(response);
  }
}
