import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SecurityEnhanced } from '@/lib/security-enhanced';

export class APISecurity {
  // 檢查 API 請求的頻率限制
  static async checkRateLimit(
    request: NextRequest,
    identifier: string,
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000 // 15 分鐘
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    // 這裡應該實現 Redis 或記憶體快取的頻率限制
    // 為了演示，我們使用簡化版本
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // 實際應用中應該從快取或資料庫獲取請求記錄
    // 這裡簡化為總是允許，但記錄請求
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }

  // 驗證 CSRF 令牌
  static validateCSRFToken(request: NextRequest): boolean {
    const csrfToken = request.headers.get('x-csrf-token');
    const sessionToken = request.headers.get('x-session-token');
    
    if (!csrfToken || !sessionToken) {
      return false;
    }
    
    return SecurityEnhanced.verifyCSRFToken(csrfToken, sessionToken);
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
    if (requireCSRF && !this.validateCSRFToken(request)) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: '無效的 CSRF 令牌' },
          { status: 403 }
        )
      };
    }

    // 3. 檢查頻率限制
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitCheck = await this.checkRateLimit(
      request,
      ipAddress,
      rateLimit.maxRequests,
      rateLimit.windowMs
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

    // 4. 檢查身份驗證
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
