import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { bookingId, revieweeId, rating, comment } = await request.json()

    const result = await db.query(async (client) => {
      // 檢查是否已評價過
      const existingReview = await client.review.findFirst({
        where: {
          bookingId,
          reviewerId: session.user.id,
          revieweeId
        }
      })

      if (existingReview) {
        throw new Error('已經評價過此預約')
      }

      // 檢查預約是否存在且已完成
      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        include: { schedule: true }
      })

      if (!booking) {
        throw new Error('預約不存在')
      }

      if (booking.status !== 'COMPLETED') {
        throw new Error('只能評價已完成的預約')
      }

      const review = await client.review.create({
        data: {
          bookingId,
          reviewerId: session.user.id,
          revieweeId,
          rating,
          comment
        },
        include: {
          reviewer: true,
          reviewee: true
        }
      })

      return { review }
    }, 'reviews:POST')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error creating review:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '創建評價失敗'
    const status = errorMessage.includes('已經評價') || errorMessage.includes('只能評價') ? 400 :
                   errorMessage.includes('不存在') ? 404 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const bookingId = searchParams.get('bookingId')

    if (!userId && !bookingId) {
      return NextResponse.json({ error: '需要提供 userId 或 bookingId' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const reviews = await client.review.findMany({
        where: {
          ...(userId ? { revieweeId: userId } : {}),
          ...(bookingId ? { bookingId } : {})
        },
        include: {
          reviewer: true,
          reviewee: true,
          booking: {
            include: {
              schedule: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return { reviews }
    }, 'reviews:GET')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching reviews:', error)
    if (error instanceof NextResponse) {
      return error
    }
    return NextResponse.json(
      { error: '獲取評價失敗' },
      { status: 500 }
    )
  }
} 