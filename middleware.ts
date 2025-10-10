import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // 安全標頭
  const securityHeaders = {
    // 強制 HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // 防止 MIME 類型嗅探
    'X-Content-Type-Options': 'nosniff',
    
    // 防止點擊劫持
    'X-Frame-Options': 'DENY',
    
    // XSS 保護
    'X-XSS-Protection': '1; mode=block',
    
    // 引用政策
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // 權限政策
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    
    // 內容安全策略
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '),
  }

  // 應用安全標頭
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // API 路由額外安全檢查
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // 防止常見攻擊
    const userAgent = request.headers.get('user-agent') || ''
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
    ]
    
    // 檢查是否為可疑的機器人請求
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      // 記錄可疑請求
      console.log(`🚨 可疑請求: ${request.nextUrl.pathname} - User-Agent: ${userAgent}`)
    }

    // 限制 API 請求頻率（簡單版本）
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    
    // 設置 API 響應標頭
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  // 防止路徑遍歷攻擊
  const pathname = request.nextUrl.pathname
  if (pathname.includes('..') || pathname.includes('~')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // 防止敏感文件訪問
  const sensitiveFiles = [
    '.env',
    '.git',
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'composer.json',
    'composer.lock',
    '.htaccess',
    'web.config',
    'robots.txt',
    'sitemap.xml'
  ]

  const isSensitiveFile = sensitiveFiles.some(file => pathname.includes(file))
  if (isSensitiveFile) {
    return new NextResponse('Not Found', { status: 404 })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}