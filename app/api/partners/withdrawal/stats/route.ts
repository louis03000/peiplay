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

      // 優化：使用 raw SQL 進行高效的 JOIN 查詢，避免多次查詢
      // 並行執行所有查詢以提高性能
      const [bookingStats, totalWithdrawnResult, pendingWithdrawals] = await Promise.all([
        // 使用 raw SQL 進行優化的 JOIN 查詢
        client.$queryRaw<Array<{ totalEarnings: number | null, totalOrders: bigint }>>`
          SELECT 
            COALESCE(SUM(b."finalAmount"), 0)::float as "totalEarnings",
            COUNT(b.id)::bigint as "totalOrders"
          FROM "Booking" b
          INNER JOIN "Schedule" s ON b."scheduleId" = s.id
          WHERE s."partnerId" = ${partner.id}
            AND b.status IN ('COMPLETED', 'CONFIRMED')
        `,
        
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

      const totalEarningsResult = {
        _sum: {
          finalAmount: bookingStats[0]?.totalEarnings || 0
        }
      };
      const totalOrders = Number(bookingStats[0]?.totalOrders || 0);

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
