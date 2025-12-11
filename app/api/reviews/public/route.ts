import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 優化：使用 Redis 快取（公開評價不常變動）
    const reviews = await Cache.getOrSet(
      CacheKeys.stats.platform() + ':public-reviews',
      async () => {
        // 獲取最新的真實用戶評價，最多顯示 3 個
        return await db.query(async (client) => {
          return await client.review.findMany({
            take: 3,
            select: {
              // 優化：使用 select 而非 include
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              reviewer: {
                select: {
                  name: true,
                  // 為了隱私，不顯示完整姓名，只顯示姓氏
                }
              },
              // 優化：不需要 booking 和 schedule 資料，移除以提升效能
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
              },
              // 只顯示管理員已審核通過的評價
              isApproved: true
            }
          });
        }, 'reviews:public')
      },
      CacheTTL.MEDIUM // 5 分鐘快取
    )

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

    // 公開資料使用 public cache
    return NextResponse.json(
      { reviews: publicReviews },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching public reviews:', error)
    return NextResponse.json(
      { error: '獲取評價失敗' },
      { status: 500 }
    )
  }
}
