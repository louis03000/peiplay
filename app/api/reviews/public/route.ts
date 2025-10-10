import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 獲取最新的真實用戶評價，最多顯示 3 個
    const reviews = await prisma.review.findMany({
      take: 3,
      include: {
        reviewer: {
          select: {
            name: true,
            // 為了隱私，不顯示完整姓名，只顯示姓氏
          }
        },
        booking: {
          include: {
            schedule: {
              include: {
                partner: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      where: {
        // 只顯示有評論的評價
        comment: {
          not: null
        },
        // 只顯示 4 星以上的評價
        rating: {
          gte: 4
        }
      }
    })

    // 處理評價數據，保護隱私
    const publicReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewerName: review.reviewer.name ? 
        review.reviewer.name.charAt(0) + '***' : '匿名用戶',
      // 隱藏具體的預約信息以保護隱私
    }))

    return NextResponse.json({ reviews: publicReviews })
  } catch (error) {
    console.error('Error fetching public reviews:', error)
    return NextResponse.json(
      { error: '獲取評價失敗' },
      { status: 500 }
    )
  }
}
