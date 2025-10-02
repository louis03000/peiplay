import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    // 檢查是否已評價過
    const existingReview = await prisma.review.findFirst({
      where: {
        bookingId,
        reviewerId: session.user.id,
        revieweeId
      }
    })

    if (existingReview) {
      return NextResponse.json({ error: '已經評價過此預約' }, { status: 400 })
    }

    // 檢查預約是否存在且已完成
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { schedule: true }
    })

    if (!booking) {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 })
    }

    if (booking.status !== 'COMPLETED') {
      return NextResponse.json({ error: '只能評價已完成的預約' }, { status: 400 })
    }

    const review = await prisma.review.create({
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

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: '創建評價失敗' },
      { status: 500 }
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

    const reviews = await prisma.review.findMany({
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

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: '獲取評價失敗' },
      { status: 500 }
    )
  }
} 