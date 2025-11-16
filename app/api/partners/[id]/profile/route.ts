import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const result = await db.query(async (tx) => {
      const partner = await tx.partner.findUnique({
        where: { id },
        include: {
          user: {
            select: { name: true }
          }
        }
      });

      if (!partner) {
        return null;
      }

      const reviewsReceived = await tx.review.findMany({
        where: {
          revieweeId: partner.userId
        },
        include: {
          reviewer: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }).catch((reviewError) => {
        console.warn('⚠️ 獲取評價失敗，繼續返回基本資料:', reviewError);
        return [];
      });

      return { partner, reviewsReceived };
    }, `partner-profile:${id}`);

    if (!result) {
      console.log(`❌ 找不到夥伴: ${id}`);
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    const { partner, reviewsReceived } = result;

    let images = partner.images || [];
    if (images.length === 0 && partner.coverImage) {
      images = [partner.coverImage];
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
      reviewsReceived: reviewsReceived.map(review => ({
        id: review.id,
        rating: review.rating || 0,
        comment: review.comment || null,
        createdAt: review.createdAt?.toISOString() || new Date().toISOString(),
        reviewer: {
          name: review.reviewer?.name || '匿名'
        }
      })),
      user: {
        name: partner.user?.name || partner.name
      }
    };

    console.log(`📊 找到夥伴資料: ${partner.name}, 評價數: ${reviewsReceived.length}`);
    return NextResponse.json({ partner: formattedPartner });

  } catch (error) {
    return createErrorResponse(error, `partners/${id}/profile`);
  }
}
