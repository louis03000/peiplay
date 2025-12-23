import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { IPGeolocation } from '@/lib/ip-geolocation'

/**
 * Next.js 中介軟體
 * 可在這裡添加全局的請求處理邏輯
 * 
 * 安全功能：
 * - IP 地理位置檢查（僅允許台灣 IP）
 * - 請求追蹤 ID
 */

export async function middleware(request: NextRequest) {
  // 在每個請求中添加請求 ID 以便追蹤
  const requestId = crypto.randomUUID()
  
  // 跳過地理位置檢查的路徑（內部 API，需要 token 驗證）
  const skipGeoCheckPaths = [
    '/api/internal/cleanup-pre-chat', // GitHub Actions 清理任務
  ];
  
  // 檢查是否為 Vercel 的健康檢查或部署檢查
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelCheck = 
    userAgent.includes('vercel') || 
    userAgent.includes('Vercel') ||
    request.headers.get('x-vercel-id') !== null ||
    request.headers.get('x-vercel-deployment-url') !== null;
  
  const shouldSkipGeoCheck = 
    process.env.SKIP_GEO_CHECK === 'true' ||
    skipGeoCheckPaths.some(path => request.nextUrl.pathname.startsWith(path)) ||
    isVercelCheck; // 允許 Vercel 的健康檢查
  
  // IP 地理位置檢查（僅允許台灣 IP）
  // 注意：可以通過環境變數 SKIP_GEO_CHECK=true 跳過此檢查（用於開發/測試）
  // 內部 API 路徑也會跳過檢查（因為它們有自己的 token 驗證）
  if (!shouldSkipGeoCheck) {
    try {
      const geoCheck = await IPGeolocation.isIPAllowed(request);
      
      if (!geoCheck.allowed) {
        // 記錄被阻擋的請求
        console.warn(`🚫 IP 地理位置阻擋:`, {
          ip: IPGeolocation.getClientIP(request),
          country: geoCheck.country,
          countryCode: geoCheck.countryCode,
          path: request.nextUrl.pathname,
          userAgent: request.headers.get('user-agent'),
          requestId,
        });

        // 返回 403 禁止訪問
        return NextResponse.json(
          {
            error: '此服務僅限台灣地區使用',
            message: 'Access denied: Service is only available in Taiwan',
            country: geoCheck.country,
            countryCode: geoCheck.countryCode,
          },
          {
            status: 403,
            headers: {
              'X-Request-ID': requestId,
            },
          }
        );
      }
    } catch (error: any) {
      // 如果地理位置檢查失敗，為了安全起見，拒絕訪問
      console.error(`❌ IP 地理位置檢查錯誤:`, error.message);
      
      return NextResponse.json(
        {
          error: '無法驗證地理位置',
          message: 'Unable to verify geolocation',
        },
        {
          status: 403,
          headers: {
            'X-Request-ID': requestId,
          },
        }
      );
    }
  }
  
  const response = NextResponse.next()
  
  response.headers.set('X-Request-ID', requestId)
  
  // 在開發環境中記錄請求
  if (process.env.NODE_ENV === 'development') {
    const clientIP = IPGeolocation.getClientIP(request);
    console.log(`[${requestId}] ${request.method} ${request.url} (IP: ${clientIP})`)
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
