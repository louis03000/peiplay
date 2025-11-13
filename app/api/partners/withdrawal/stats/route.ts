import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 平台抽成比例
const PLATFORM_FEE_PERCENTAGE = 0.15; // 15%

export async function GET(request: NextRequest) {
  try {
    console.log("✅ partners/withdrawal/stats GET api triggered");
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    console.log("🔐 Session check:", { hasSession: !!session, userId: session?.user?.id });
    
    if (!session?.user?.id) {
      console.log("❌ 未登入");
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 使用帶有重試機制的資料庫查詢
    const result = await db.query(async (client) => {
      // 檢查是否為夥伴
      console.log("🔍 查詢夥伴資料...");
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          referralEarnings: true // 夥伴的推薦收入
        }
      });
      
      console.log("👤 夥伴資料:", { partnerId: partner?.id, hasPartner: !!partner });

      if (!partner) {
        console.log("❌ 用戶不是夥伴");
        throw new Error('您不是夥伴');
      }

      // 並行執行所有資料庫查詢以提高性能
      const [totalEarningsResult, totalOrders, totalWithdrawnResult, pendingWithdrawals] = await Promise.all([
        // 計算總收入
        client.booking.aggregate({
          where: {
            schedule: { partnerId: partner.id },
            status: { in: ['COMPLETED', 'CONFIRMED'] }
          },
          _sum: { finalAmount: true }
        }),
        
        // 計算總接單數
        client.booking.count({
          where: {
            schedule: { partnerId: partner.id },
            status: { in: ['COMPLETED', 'CONFIRMED'] }
          }
        }),
        
        // 計算已提領總額
        client.withdrawalRequest.aggregate({
          where: {
            partnerId: partner.id,
            status: { in: ['APPROVED', 'COMPLETED'] }
          },
          _sum: { amount: true }
        }),
        
        // 計算待審核的提領申請數
        client.withdrawalRequest.count({
          where: {
            partnerId: partner.id,
            status: 'PENDING'
          }
        })
      ]);

      const totalEarnings = totalEarningsResult._sum.finalAmount || 0;
      const totalWithdrawn = totalWithdrawnResult._sum.amount || 0;
      const referralEarnings = partner.referralEarnings || 0;

      // 計算可提領餘額
      const partnerEarnings = totalEarnings * (1 - PLATFORM_FEE_PERCENTAGE);
      const availableBalance = partnerEarnings + referralEarnings - totalWithdrawn;

      console.log('📊 提領統計計算結果:', {
        partnerId: partner.id,
        totalEarnings,
        totalOrders,
        partnerEarnings,
        referralEarnings,
        totalWithdrawn,
        availableBalance,
        pendingWithdrawals
      });

      return {
        totalEarnings,
        totalOrders,
        availableBalance: Math.max(0, availableBalance),
        pendingWithdrawals,
        referralEarnings
      };
    }, 'partners/withdrawal/stats');

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ 獲取提領統計時發生錯誤:', error);
    return createErrorResponse(error, 'partners/withdrawal/stats');
  }
}
