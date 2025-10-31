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

    // Prisma 會自動管理連接池
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

  } catch (error: any) {
    console.error('Partners self GET error:', error);
    console.error('錯誤詳情:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    });
    
    // 處理 Prisma 錯誤
    if (error?.code) {
      switch (error.code) {
        case 'P1001':
          // 資料庫連線錯誤，返回友好訊息但不返回 500
          console.warn('資料庫連線錯誤，返回 null partner');
          return NextResponse.json({ 
            partner: null,
            error: null  // 不顯示錯誤給用戶
          }, { status: 200 });
        default:
          // 其他資料庫錯誤
          return NextResponse.json({ 
            partner: null,
            error: null  // 不顯示錯誤給用戶
          }, { status: 200 });
      }
    }
    
    // 對於其他錯誤，也返回 null partner 而不是錯誤
    return NextResponse.json({ 
      partner: null,
      error: null  // 不顯示錯誤給用戶
    }, { status: 200 });
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
    
    // Prisma 會自動管理連接池
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

  } catch (error: any) {
    console.error('Partners self PATCH error:', error);
    console.error('錯誤詳情:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    });
    
    // 處理 Prisma 錯誤
    if (error?.code) {
      switch (error.code) {
        case 'P2002':
          return NextResponse.json({ 
            error: '資料重複，請檢查輸入',
            details: '嘗試更新的資料已存在'
          }, { status: 409 });
        case 'P2025':
          return NextResponse.json({ 
            error: '夥伴資料不存在',
            details: '找不到要更新的記錄'
          }, { status: 404 });
        default:
          return NextResponse.json({ 
            error: '更新失敗',
            details: error.message || '請稍後再試'
          }, { status: 500 });
      }
    }
    
    return NextResponse.json({ 
      error: '更新失敗',
      details: error instanceof Error ? error.message : '請稍後再試'
    }, { status: 500 });
  }
} 