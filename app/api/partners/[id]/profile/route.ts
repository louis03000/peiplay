import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db-resilience';
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const { id } = resolvedParams;

  try {
    // 優化：使用 Redis 快取（夥伴資料不常變動）
    const result = await Cache.getOrSet(
      CacheKeys.partners.detail(id) + ':profile',
      async () => {
        return await db.query(async (tx) => {
          const partner = await tx.partner.findUnique({
            where: { id },
            select: {
              // 優化：使用 select 而非 include
              id: true,
              name: true,
              birthday: true,
              gender: true,
              interests: true,
              games: true,
              supportsChatOnly: true,
              chatOnlyRate: true,
              halfHourlyRate: true,
              customerMessage: true,
              images: true,
              coverImage: true,
              rankBoosterImages: true,
              isRankBooster: true,
              rankBoosterNote: true,
              rankBoosterRank: true,
              userId: true,
              user: {
                select: { name: true }
              }
            }
          });

      if (!partner) {
        return null;
      }

          if (!partner) {
            return null;
          }

          // 查詢一般預約的評價（Review 表）
          const reviewsReceived = await tx.review.findMany({
            where: {
              revieweeId: partner.userId
            },
            select: {
              // 優化：使用 select 而非 include
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              reviewer: {
                select: { name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 50, // 限制評價數量
          }).catch((reviewError) => {
            console.warn('⚠️ 獲取評價失敗，繼續返回基本資料:', reviewError);
            return [];
          });

          // 查詢群組預約的評價（GroupBookingReview 表）
          // 先找到所有包含該夥伴的 GroupBooking ID（通過 Booking 表的 partnerId）
          const groupBookingsWithPartner = await tx.booking.findMany({
            where: {
              partnerId: partner.id,
              groupBookingId: { not: null }
            },
            select: {
              groupBookingId: true
            }
          }).catch(() => []);

          // 手動去重：使用 Set 來過濾重複的 groupBookingId
          const groupBookingIds = Array.from(
            new Set(
              groupBookingsWithPartner
                .map(b => b.groupBookingId)
                .filter((id): id is string => id !== null)
            )
          );

          // 如果沒有相關的群組預約，跳過查詢
          const groupBookingReviews = groupBookingIds.length > 0
            ? await tx.groupBookingReview.findMany({
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
                        select: { name: true }
                      }
                    }
                  }
                },
                orderBy: { createdAt: 'desc' },
                take: 50, // 限制評價數量
              }).catch((groupReviewError) => {
                console.warn('⚠️ 獲取群組預約評價失敗:', groupReviewError);
                return [];
              })
            : [];

          // 將 GroupBookingReview 轉換為與 Review 相同的格式
          const formattedGroupReviews = groupBookingReviews.map(gbr => ({
            id: gbr.id,
            rating: gbr.rating,
            comment: gbr.comment,
            createdAt: gbr.createdAt,
            reviewer: {
              name: gbr.Customer?.user?.name || '匿名'
            }
          }));

          // 合併兩種評價，按時間排序
          const allReviews = [...reviewsReceived, ...formattedGroupReviews]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 50); // 限制總數為 50

          return { partner, reviewsReceived: allReviews };
        }, `partner-profile:${id}`);
      },
      CacheTTL.MEDIUM // 5 分鐘快取
    );

    if (!result) {
      console.log(`❌ 找不到夥伴: ${id}`);
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    const { partner, reviewsReceived } = result;

    let images = partner.images || [];
    if (images.length === 0 && partner.coverImage) {
      images = [partner.coverImage];
    }
    // 如果有上分高手圖片，合併到圖片列表中
    if (partner.isRankBooster && partner.rankBoosterImages?.length) {
      images = [...images, ...partner.rankBoosterImages];
    }
    images = images.slice(0, 3);
    
    const formattedPartner = {
      id: partner.id,
      name: partner.name,
      birthday: partner.birthday?.toISOString() || new Date().toISOString(),
      gender: partner.gender || null,
      interests: Array.isArray(partner.interests) ? partner.interests : [],
      games: Array.isArray(partner.games) ? partner.games : [],
      supportsChatOnly: Boolean(partner.supportsChatOnly),
      chatOnlyRate: partner.chatOnlyRate ?? null,
      halfHourlyRate: partner.halfHourlyRate || 0,
      customerMessage: partner.customerMessage || null,
      images: Array.isArray(images) ? images : [],
      isRankBooster: Boolean(partner.isRankBooster),
      rankBoosterImages: Array.isArray(partner.rankBoosterImages) ? partner.rankBoosterImages : [],
      rankBoosterNote: partner.rankBoosterNote || null,
      rankBoosterRank: partner.rankBoosterRank || null,
      reviewsReceived: reviewsReceived.map(review => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.comment || null,
        createdAt: review.createdAt?.toISOString() || new Date().toISOString(),
        reviewer: {
          name: '匿名' // 統一顯示為匿名，保護評價人隱私
        }
      })),
      user: {
        name: partner.user?.name || partner.name
      }
    };

    console.log(`📊 找到夥伴資料: ${partner.name}, 評價數: ${reviewsReceived.length}`);
    
    // 公開資料使用 public cache
    return NextResponse.json(
      { partner: formattedPartner },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );

  } catch (error) {
    return createErrorResponse(error, `partners/${id}/profile`);
  }
}
