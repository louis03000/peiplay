import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * 獲取所有多人陪玩和群組預約的評論（管理員用）
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const reviews = await db.query(async (client) => {
      return client.groupBookingReview.findMany({
        select: {
          id: true,
          groupBookingId: true,
          rating: true,
          comment: true,
          createdAt: true,
          Customer: {
            select: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          },
          GroupBooking: {
            select: {
              id: true,
              title: true,
              date: true,
              startTime: true,
              endTime: true,
              type: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100 // 限制結果數量
      })
    }, 'admin:group-booking-reviews:get')

    return NextResponse.json({ reviews })
  } catch (error) {
    return createErrorResponse(error, 'admin:group-booking-reviews:get')
  }
}

/**
 * 刪除多人陪玩或群組預約的評論（管理員用）
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { reviewId } = await request.json()

    if (!reviewId) {
      return NextResponse.json({ error: '缺少 reviewId 參數' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      // 檢查評論是否存在
      const review = await client.groupBookingReview.findUnique({
        where: { id: reviewId }
      })

      if (!review) {
        return { type: 'NOT_FOUND' } as const
      }

      // 刪除評論
      await client.groupBookingReview.delete({
        where: { id: reviewId }
      })

      return { type: 'SUCCESS' } as const
    }, 'admin:group-booking-reviews:delete')

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '評論不存在' }, { status: 404 })
    }

    return NextResponse.json({ message: '評論已刪除' })
  } catch (error) {
    return createErrorResponse(error, 'admin:group-booking-reviews:delete')
  }
}

