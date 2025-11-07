import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Next.js 中介軟體
 * 可在這裡添加全局的請求處理邏輯
 */

export function middleware(request: NextRequest) {
  // 在每個請求中添加請求 ID 以便追蹤
  const requestId = crypto.randomUUID()
  const response = NextResponse.next()
  
  response.headers.set('X-Request-ID', requestId)
  
  // 在開發環境中記錄請求
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${requestId}] ${request.method} ${request.url}`)
  }

  return response
}

// 配置哪些路徑需要經過中介軟體
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
