import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log(`✅ partners/${id}/profile GET api triggered`);

    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    if (!partner) {
      console.log(`❌ 找不到夥伴: ${id}`);
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    // 獲取該夥伴收到的評價
    const reviewsReceived = await prisma.review.findMany({
      where: {
        revieweeId: partner.userId
      },
      include: {
        reviewer: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 格式化數據，確保所有字段都有默認值
    const formattedPartner = {
      id: partner.id,
      name: partner.name,
      birthday: partner.birthday.toISOString(),
      gender: partner.gender || '未提供',
      interests: partner.interests || [],
      games: partner.games || [],
      supportsChatOnly: partner.supportsChatOnly || false,
      chatOnlyRate: partner.chatOnlyRate || null,
      halfHourlyRate: partner.halfHourlyRate,
      images: partner.images || [],
      reviewsReceived: reviewsReceived.map(review => ({
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

  } catch (error: any) {
    console.error('❌ 獲取夥伴資料失敗:', error);
    console.error('❌ 錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error?.code,
      meta: error?.meta
    });
    
    // 如果是資料庫連接錯誤
    if (error?.code === 'P1001') {
      return NextResponse.json({
        error: '資料庫連接失敗，請稍後再試'
      }, { status: 503 });
    }
    
    return NextResponse.json({
      error: '獲取夥伴資料失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
