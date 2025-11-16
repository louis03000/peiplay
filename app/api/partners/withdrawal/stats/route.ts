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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 使用帶有重試機制的資料庫查詢
    const result = await db.query(async (client) => {
      // 檢查是否為夥伴
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          referralEarnings: true
        }
      });

      if (!partner) {
        throw new Error('您不是夥伴');
      }

      // 優化：先並行獲取 scheduleIds 和 withdrawal 相關查詢
      // 然後使用 scheduleIds 直接查詢 booking，避免嵌套查詢
      const [scheduleIdsResult, totalWithdrawnResult, pendingWithdrawals] = await Promise.all([
        // 獲取所有相關的 schedule IDs（使用索引，查詢很快）
        client.schedule.findMany({
          where: { partnerId: partner.id },
          select: { id: true },
        }),
        
        // 計算已提領總額 - 使用索引優化的查詢
        client.withdrawalRequest.aggregate({
          where: {
            partnerId: partner.id,
            status: { in: ['APPROVED', 'COMPLETED'] }
          },
          _sum: { amount: true }
        }),
        
        // 計算待審核的提領申請數 - 使用索引優化的查詢
        client.withdrawalRequest.count({
          where: {
            partnerId: partner.id,
            status: 'PENDING'
          }
        })
      ]);

      const scheduleIds = scheduleIdsResult.map(s => s.id);

      // 如果沒有 schedule，直接返回空結果
      if (scheduleIds.length === 0) {
        return {
          totalEarnings: 0,
          totalOrders: 0,
          availableBalance: Math.max(0, partner.referralEarnings || 0),
          pendingWithdrawals,
          referralEarnings: partner.referralEarnings || 0
        };
      }

      // 使用 scheduleIds 直接查詢 booking（使用 scheduleId 索引，查詢很快）
      const [totalEarningsResult, totalOrders] = await Promise.all([
        client.booking.aggregate({
          where: {
            scheduleId: { in: scheduleIds },
            status: { in: ['COMPLETED', 'CONFIRMED'] }
          },
          _sum: { finalAmount: true }
        }),
        
        client.booking.count({
          where: {
            scheduleId: { in: scheduleIds },
            status: { in: ['COMPLETED', 'CONFIRMED'] }
          }
        })
      ]);

      const totalEarnings = totalEarningsResult._sum.finalAmount || 0;
      const totalWithdrawn = totalWithdrawnResult._sum.amount || 0;
      const referralEarnings = partner.referralEarnings || 0;

      // 計算可提領餘額
      const partnerEarnings = totalEarnings * (1 - PLATFORM_FEE_PERCENTAGE);
      const availableBalance = partnerEarnings + referralEarnings - totalWithdrawn;

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
