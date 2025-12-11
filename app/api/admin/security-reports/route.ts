import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    
    // 優化：支援 cursor-based pagination（避免大偏移量效能問題）
    const cursor = searchParams.get('cursor') // JSON: {timestamp: '...', id: '...'}
    const useCursorPagination = cursor || offset > 100

    const reports = await db.query(async (client) => {
      // 優化：使用 cursor-based pagination
      let cursorCondition: any = {};
      if (useCursorPagination && cursor) {
        try {
          const cursorData = JSON.parse(cursor);
          cursorCondition = {
            OR: [
              { timestamp: { lt: new Date(cursorData.timestamp) } },
              {
                timestamp: new Date(cursorData.timestamp),
                id: { lt: cursorData.id },
              },
            ],
          };
        } catch (e) {
          console.warn('Invalid cursor format, falling back to offset');
        }
      }

      return client.securityLog.findMany({
        where: cursorCondition,
        select: {
          // 優化：使用 select 而非 include
          id: true,
          userId: true,
          action: true,
          details: true,
          ipAddress: true,
          userAgent: true,
          timestamp: true,
        },
        orderBy: [
          { timestamp: 'desc' },
          { id: 'desc' }, // 確保排序穩定
        ],
        take: limit,
        ...(useCursorPagination ? {} : { skip: offset }), // 僅在非 cursor pagination 時使用 skip
      })
    }, 'admin:security-reports:get')

    // 個人資料使用 private cache
    return NextResponse.json(
      { reports },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    return createErrorResponse(error, 'admin:security-reports:get')
  }
}
