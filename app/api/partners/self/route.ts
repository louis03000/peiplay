import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("✅ partners/self GET api triggered");
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: '未登入',
        partner: null 
      }, { status: 401 });
    }

    await prisma.$connect();

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!partner) {
      console.log(`❌ 用戶 ${session.user.id} 沒有夥伴資料`);
      return NextResponse.json({ partner: null });
    }

    console.log(`✅ 找到夥伴資料: ${partner.name}, 狀態: ${partner.status}`);
    return NextResponse.json({ partner });

  } catch (error) {
    console.error('Partners self GET error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      partner: null 
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}

export async function PATCH(request: Request) {
  try {
    console.log("✅ partners/self PATCH api triggered");
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: '未登入'
      }, { status: 401 });
    }

    const { isAvailableNow, isRankBooster, allowGroupBooking, rankBoosterNote, rankBoosterRank, customerMessage, availableNowSince } = await request.json();
    
    await prisma.$connect();

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    });

    if (!partner) {
      return NextResponse.json({ 
        error: '找不到夥伴資料'
      }, { status: 404 });
    }

    const updatedPartner = await prisma.partner.update({
      where: { userId: session.user.id },
      data: {
        isAvailableNow: isAvailableNow !== undefined ? isAvailableNow : partner.isAvailableNow,
        isRankBooster: isRankBooster !== undefined ? isRankBooster : partner.isRankBooster,
        allowGroupBooking: allowGroupBooking !== undefined ? allowGroupBooking : partner.allowGroupBooking,
        rankBoosterNote: rankBoosterNote !== undefined ? rankBoosterNote : partner.rankBoosterNote,
        rankBoosterRank: rankBoosterRank !== undefined ? rankBoosterRank : partner.rankBoosterRank,
        customerMessage: customerMessage !== undefined ? customerMessage : partner.customerMessage,
        availableNowSince: availableNowSince ? new Date(availableNowSince) : partner.availableNowSince,
      }
    });
    
    console.log(`✅ 夥伴資料已更新: ${updatedPartner.name}`);
    return NextResponse.json({ partner: updatedPartner });

  } catch (error) {
    console.error('Partners self PATCH error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
} 