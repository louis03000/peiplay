import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    // 優化：使用 select 而非 include，只查詢必要欄位，並限制結果數量
    const reviews = await db.query(async (client) => {
      return client.review.findMany({
        where: {
          comment: {
            not: null,
          },
        },
        select: {
          id: true,
          bookingId: true,
          reviewerId: true,
          revieweeId: true,
          rating: true,
          comment: true,
          isApproved: true,
          createdAt: true,
          updatedAt: true,
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reviewee: {
            select: {
              id: true,
              name: true,
            },
          },
          booking: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              schedule: {
                select: {
                  id: true,
                  date: true,
                  startTime: true,
                  endTime: true,
                  partner: {
                    select: {
                      id: true,
                      name: true,
                      games: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100, // 限制結果數量
      })
    }, 'admin:reviews:get')

    return NextResponse.json({ reviews })
  } catch (error) {
    return createErrorResponse(error, 'admin:reviews:get')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { reviewId, action } = await request.json()

    if (!reviewId || !action) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const review = await db.query(async (client) => {
      if (action === 'approve') {
        return client.review.update({
          where: { id: reviewId },
          data: {
            isApproved: true,
            approvedAt: new Date(),
          },
        })
      }

      if (action === 'reject') {
        return client.review.update({
          where: { id: reviewId },
          data: {
            isApproved: false,
            approvedAt: null,
          },
        })
      }

      return { id: null } as any
    }, 'admin:reviews:moderate')

    if (!review?.id) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 })
    }

    return NextResponse.json({
      message: action === 'approve' ? '評價已通過審核' : '評價已拒絕',
      review,
    })
  } catch (error) {
    return createErrorResponse(error, 'admin:reviews:moderate')
  }
}
