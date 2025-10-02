import { NextRequest, NextResponse } from 'next/server';
import { securityHeaders, IPFilter, SecurityLogger } from './lib/security';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 獲取客戶端 IP
  const clientIP = IPFilter.getClientIP(request);
  
  // 檢查 IP 是否被封鎖
  if (IPFilter.isBlocked(clientIP)) {
    SecurityLogger.logSecurityEvent('BLOCKED_IP_ACCESS', {
      ip: clientIP,
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') || 'unknown'
    });
    
    return new NextResponse('Access Denied', { status: 403 });
  }
  
  // 添加安全標頭
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // 添加自定義安全標頭
  response.headers.set('X-Request-ID', crypto.randomUUID());
  response.headers.set('X-Response-Time', Date.now().toString());
  
  // 記錄可疑活動
  const suspiciousPatterns = [
    /\.\./,  // 路徑遍歷
    /<script/i,  // XSS 嘗試
    /union.*select/i,  // SQL 注入
    /javascript:/i,  // JavaScript 協議
  ];
  
  const url = request.nextUrl.pathname + request.nextUrl.search;
  const userAgent = request.headers.get('user-agent') || '';
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(userAgent)) {
      SecurityLogger.logSuspiciousActivity('SUSPICIOUS_REQUEST', {
        ip: clientIP,
        path: url,
        userAgent,
        pattern: pattern.toString()
      });
      break;
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有請求路徑，除了：
     * - api (API 路由)
     * - _next/static (靜態文件)
     * - _next/image (圖片優化文件)
     * - favicon.ico (網站圖標)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
