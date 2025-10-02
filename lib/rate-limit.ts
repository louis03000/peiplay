import { NextRequest, NextResponse } from 'next/server';
import { IPFilter } from './security';

// 簡單的記憶體速率限制器
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每分鐘清理過期的記錄
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  isAllowed(
    key: string,
    windowMs: number,
    maxRequests: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const current = this.requests.get(key);
    
    if (!current || now > current.resetTime) {
      // 新的時間窗口或過期記錄
      this.requests.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime
      };
    }
    
    if (current.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      };
    }
    
    current.count++;
    return {
      allowed: true,
      remaining: maxRequests - current.count,
      resetTime: current.resetTime
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// 全域速率限制器實例
const rateLimiter = new RateLimiter();

// 速率限制中間件
export function withRateLimit(
  windowMs: number = 15 * 60 * 1000, // 15 分鐘
  maxRequests: number = 100, // 100 次請求
  keyGenerator?: (request: NextRequest) => string
) {
  return function rateLimitMiddleware(
    handler: (request: NextRequest) => Promise<NextResponse>
  ) {
    return async function(request: NextRequest) {
      // 獲取客戶端 IP
      const clientIP = IPFilter.getClientIP(request);
      
      // 檢查 IP 是否被封鎖
      if (IPFilter.isBlocked(clientIP)) {
        return NextResponse.json(
          { error: 'IP 已被封鎖' },
          { status: 403 }
        );
      }
      
      // 生成速率限制鍵
      const key = keyGenerator ? keyGenerator(request) : clientIP;
      
      // 檢查速率限制
      const result = rateLimiter.isAllowed(key, windowMs, maxRequests);
      
      if (!result.allowed) {
        // 記錄可疑活動
        console.log(`🔒 Rate limit exceeded for IP: ${clientIP}`);
        
        return NextResponse.json(
          { 
            error: '請求過於頻繁，請稍後再試',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.resetTime.toString(),
            }
          }
        );
      }
      
      // 添加速率限制標頭
      const response = await handler(request);
      
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
      
      return response;
    };
  };
}

// 敏感操作速率限制
export function withSensitiveRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withRateLimit(
    15 * 60 * 1000, // 15 分鐘
    5, // 5 次請求
    (request) => {
      const clientIP = IPFilter.getClientIP(request);
      const path = request.nextUrl.pathname;
      return `${clientIP}:${path}`;
    }
  )(handler);
}

// 登入速率限制
export function withLoginRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withRateLimit(
    15 * 60 * 1000, // 15 分鐘
    5, // 5 次登入嘗試
    (request) => {
      const clientIP = IPFilter.getClientIP(request);
      return `login:${clientIP}`;
    }
  )(handler);
}

// 註冊速率限制
export function withRegisterRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withRateLimit(
    60 * 60 * 1000, // 1 小時
    3, // 3 次註冊嘗試
    (request) => {
      const clientIP = IPFilter.getClientIP(request);
      return `register:${clientIP}`;
    }
  )(handler);
}

// 清理速率限制器（在應用關閉時調用）
export function cleanupRateLimiter() {
  rateLimiter.destroy();
}
