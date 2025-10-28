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
        }
      }
    });

    if (!partner) {
      console.log(`❌ 找不到夥伴: ${params.id}`);
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

  } catch (error) {
    console.error('❌ 獲取夥伴資料失敗:', error);
    console.error('❌ 錯誤詳情:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ 錯誤堆疊:', error instanceof Error ? error.stack : 'No stack trace');
    
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
