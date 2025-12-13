import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await db.query(async (client) => {
      // 獲取所有夥伴的基本信息
      const partners = await client.partner.findMany({
        where: {
          status: 'APPROVED'
        },
        select: {
          id: true,
          name: true,
          games: true,
          halfHourlyRate: true,
          coverImage: true
        }
      });

      // 優化：批量查詢所有夥伴的評價，避免 N+1 查詢問題
      const partnerIds = partners.map(p => p.id);
      const allReviews = await client.review.findMany({
        where: {
          revieweeId: { in: partnerIds },
          isApproved: true
        },
        select: {
          revieweeId: true,
          rating: true
        }
      });

      // 在記憶體中計算每個夥伴的平均評價
      const reviewsByPartnerId = new Map<string, number[]>();
      allReviews.forEach(review => {
        if (!reviewsByPartnerId.has(review.revieweeId)) {
          reviewsByPartnerId.set(review.revieweeId, []);
        }
        reviewsByPartnerId.get(review.revieweeId)!.push(review.rating);
      });

      // 為每個夥伴計算平均評價
      const partnersWithRatings = partners.map(partner => {
        const ratings = reviewsByPartnerId.get(partner.id) || [];
        let averageRating = 0;
        let totalReviews = ratings.length;

        if (ratings.length > 0) {
          const totalRating = ratings.reduce((sum, rating) => sum + rating, 0);
          averageRating = Math.round((totalRating / ratings.length) * 10) / 10;
        }

        return {
          ...partner,
          averageRating,
          totalReviews
        };
      });

      // 按平均評價排序（評價高的在前）
      partnersWithRatings.sort((a, b) => {
        if (b.averageRating === a.averageRating) {
          return b.totalReviews - a.totalReviews; // 評價數量多的在前
        }
        return b.averageRating - a.averageRating;
      });

      return { partners: partnersWithRatings }
    }, 'partners/ratings')

    // 公開資料使用 public cache（但變動頻繁，使用較短時間）
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    })

  } catch (error) {
    console.error('Error fetching partners with ratings:', error);
    return NextResponse.json(
      { error: '獲取夥伴評價失敗' },
      { status: 500 }
    );
  }
}
