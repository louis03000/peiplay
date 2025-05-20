import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// 簡單的記憶體快取來追蹤請求
const rateLimit = new Map<string, { count: number; resetTime: number }>()

// 清理過期的限制
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimit.entries()) {
    if (value.resetTime < now) {
      rateLimit.delete(key)
    }
  }
}, 60000) // 每分鐘清理一次

export async function middleware(request: NextRequest) {
  // 只處理登入和註冊請求
  if (!request.nextUrl.pathname.match(/^\/api\/(auth|register)/)) {
    return NextResponse.next()
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 分鐘
  const maxRequests = 5 // 15 分鐘內最多 5 次請求

  // 取得或初始化限制
  const limit = rateLimit.get(ip) ?? {
    count: 0,
    resetTime: now + windowMs
  }

  // 如果已經超過限制
  if (limit.count >= maxRequests) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests, please try again later.'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '900' // 15 分鐘
        }
      }
    )
  }

  // 更新計數
  limit.count++
  rateLimit.set(ip, limit)

  // 繼續處理請求
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*', '/api/register/:path*']
} 