import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`✅ partners/${params.id}/profile GET api triggered`);
    
    await prisma.$connect();

    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { name: true }
        },
        reviewsReceived: {
          include: {
            reviewer: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    // 格式化數據
    const formattedPartner = {
      id: partner.id,
      name: partner.name,
      birthday: partner.birthday.toISOString(),
      gender: partner.gender,
      interests: partner.interests,
      games: partner.games,
      supportsChatOnly: partner.supportsChatOnly,
      chatOnlyRate: partner.chatOnlyRate,
      halfHourlyRate: partner.halfHourlyRate,
      images: partner.images,
      reviewsReceived: partner.reviewsReceived.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        reviewer: {
          name: review.reviewer.name
        }
      })),
      user: {
        name: partner.user.name
      }
    };

    console.log(`📊 找到夥伴資料: ${partner.name}`);
    return NextResponse.json({ partner: formattedPartner });

  } catch (error) {
    console.error('❌ 獲取夥伴資料失敗:', error);
    return NextResponse.json({
      error: '獲取夥伴資料失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}
