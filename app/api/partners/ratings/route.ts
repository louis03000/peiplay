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

      // 為每個夥伴計算平均評價
      const partnersWithRatings = await Promise.all(
        partners.map(async (partner) => {
          const reviews = await client.review.findMany({
          where: {
            revieweeId: partner.id,
            isApproved: true
          },
          select: {
            rating: true
          }
        });

        let averageRating = 0;
        let totalReviews = 0;

        if (reviews.length > 0) {
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          averageRating = Math.round((totalRating / reviews.length) * 10) / 10;
          totalReviews = reviews.length;
        }

        return {
          ...partner,
          averageRating,
          totalReviews
        };
      })
    );

      // 按平均評價排序（評價高的在前）
      partnersWithRatings.sort((a, b) => {
        if (b.averageRating === a.averageRating) {
          return b.totalReviews - a.totalReviews; // 評價數量多的在前
        }
        return b.averageRating - a.averageRating;
      });

      return { partners: partnersWithRatings }
    }, 'partners/ratings')

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error fetching partners with ratings:', error);
    return NextResponse.json(
      { error: '獲取夥伴評價失敗' },
      { status: 500 }
    );
  }
}
