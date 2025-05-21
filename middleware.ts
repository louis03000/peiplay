import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createI18nMiddleware from 'next-intl/middleware'

// Simple in-memory rate limiting
const rateLimit = new Map<string, { count: number; resetTime: number }>()

// Clean up expired limits
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimit.entries()) {
    if (value.resetTime < now) {
      rateLimit.delete(key)
    }
  }
}, 60000) // Clean up every minute

const I18nMiddleware = createI18nMiddleware({
  locales: ['en', 'zh-TW', 'zh-CN'],
  defaultLocale: 'zh-TW',
  localePrefix: 'as-needed'
})

export async function middleware(request: NextRequest) {
  // Rate limiting for auth routes
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const now = Date.now()
    const windowMs = 5 * 60 * 1000 // 5 minutes
    const maxRequests = 5 // 5 requests per 5 minutes

    // Get or initialize limit
    const limit = rateLimit.get(ip) ?? {
      count: 0,
      resetTime: now + windowMs
    }

    // Check if limit exceeded
    if (limit.count >= maxRequests) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': limit.resetTime.toString(),
        },
      })
    }

    // Update count
    limit.count++
    rateLimit.set(ip, limit)
  }

  // Handle i18n
  const response = I18nMiddleware(request)
  return response
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
} 