import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json(
        { error: '缺少夥伴ID參數' },
        { status: 400 }
      );
    }

    const result = await db.query(async (client) => {
      // 獲取該夥伴的所有已審核評價
      const reviews = await client.review.findMany({
      where: {
        revieweeId: partnerId,
        isApproved: true // 只計算已審核通過的評價
      },
      select: {
        rating: true,
        comment: true,
        createdAt: true
      }
    });

      if (reviews.length === 0) {
        return {
          averageRating: 0,
          totalReviews: 0,
          ratingBreakdown: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
          },
          recentReviews: []
        };
      }

      // 計算平均評價
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = Math.round((totalRating / reviews.length) * 10) / 10; // 保留一位小數

      // 計算評價分布
      const ratingBreakdown = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
      };

      reviews.forEach(review => {
        ratingBreakdown[review.rating as keyof typeof ratingBreakdown]++;
      });

      // 獲取最近的評價（最多5條）
      const recentReviews = reviews
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(review => ({
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt
        }));

      return {
        averageRating,
        totalReviews: reviews.length,
        ratingBreakdown,
        recentReviews
      };
    }, 'partners/average-rating')

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error fetching partner average rating:', error);
    return NextResponse.json(
      { error: '獲取夥伴評價失敗' },
      { status: 500 }
    );
  }
}
