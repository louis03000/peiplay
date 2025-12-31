import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

/**
 * 獲取多人陪玩的評論列表
 * 多人陪玩的評論存儲在 GroupBookingReview 表中
 * 如果提供了 multiPlayerBookingId，只返回該預約的評論
 * 如果沒有提供，返回所有多人陪玩的評論
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const multiPlayerBookingId = searchParams.get('multiPlayerBookingId')

    const reviews = await db.query(async (client) => {
      let groupBookingIds: string[] = []

      if (multiPlayerBookingId) {
        // 如果提供了 multiPlayerBookingId，只查找該預約的評論
        const groupBooking = await client.groupBooking.findUnique({
          where: { id: multiPlayerBookingId },
          select: { id: true }
        })

        if (!groupBooking) {
          return []
        }

        groupBookingIds = [groupBooking.id]
      } else {
        // 如果沒有提供 multiPlayerBookingId，獲取所有多人陪玩的評論
        // 多人陪玩的 GroupBooking 標題通常包含 "多人陪玩評價"
        const groupBookings = await client.groupBooking.findMany({
          where: {
            title: {
              contains: '多人陪玩評價'
            }
          },
          select: {
            id: true
          }
        })

        groupBookingIds = groupBookings.map(gb => gb.id)
      }

      if (groupBookingIds.length === 0) {
        return []
      }

      // 獲取所有相關的評論
      const groupBookingReviews = await client.groupBookingReview.findMany({
        where: {
          groupBookingId: {
            in: groupBookingIds
          }
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          Customer: {
            select: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // 格式化評論數據
      return groupBookingReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        reviewerName: review.Customer?.user?.name || '匿名用戶'
      }))
    }, 'multi-player-booking:reviews')

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('獲取多人陪玩評論失敗:', error)
    return NextResponse.json({ error: '獲取評論失敗' }, { status: 500 })
  }
}

