import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { getPartnerLastWeekRank, calculatePlatformFeePercentage } from '@/lib/ranking-helpers'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 先檢查是否為夥伴
    const partnerCheck = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      });
      return partner;
    }, 'partners/withdrawal/stats:check');

    if (!partnerCheck) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
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

      // 優化：使用 raw SQL 進行高效的 JOIN 查詢
      // 添加日期範圍限制，只查詢最近 2 年的數據（大幅減少掃描量）
      // 並行執行所有查詢以提高性能
      // 關鍵：確保 Schedule 表有 partnerId + date 複合索引，Booking 表有 scheduleId + status 複合索引
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      // 優化：先執行快的查詢（withdrawal 相關），然後執行較慢的 booking 查詢
      // 這樣即使 booking 查詢慢，用戶也能先看到部分結果
      const [totalWithdrawnResult, pendingWithdrawals, bookingStats] = await Promise.all([
        // 計算已提領總額 - 使用 WithdrawalRequest.partnerId_status 複合索引（通常很快）
        client.withdrawalRequest.aggregate({
          where: {
            partnerId: partner.id,
            status: { in: ['APPROVED', 'COMPLETED'] }
          },
          _sum: { amount: true }
        }),
        
        // 計算待審核的提領申請數 - 使用 WithdrawalRequest.partnerId_status 複合索引（通常很快）
        client.withdrawalRequest.count({
          where: {
            partnerId: partner.id,
            status: 'PENDING'
          }
        }),
        
        // 使用 raw SQL 進行優化的 JOIN 查詢（可能較慢，但已優化）
        // 添加日期限制：只查詢最近 2 年的預約，大幅減少掃描的數據量
        // 使用 Schedule.partnerId_date 複合索引和 Booking.scheduleId_status 複合索引
        client.$queryRaw<Array<{ totalEarnings: number | null, totalOrders: bigint }>>`
          SELECT 
            COALESCE(SUM(b."finalAmount"), 0)::float as "totalEarnings",
            COUNT(b.id)::bigint as "totalOrders"
          FROM "Booking" b
          INNER JOIN "Schedule" s ON b."scheduleId" = s.id
          WHERE s."partnerId" = ${partner.id}::text
            AND b.status IN ('COMPLETED', 'CONFIRMED')
            AND s.date >= ${twoYearsAgo}::timestamp
        `
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

      // 獲取夥伴上一週的排名並計算平台維護費
      // 本週的排名決定下週的減免，所以計算當前週的費用時，需要查詢上一週的排名
      const rank = await getPartnerLastWeekRank(partner.id);
      const PLATFORM_FEE_PERCENTAGE = calculatePlatformFeePercentage(rank);

      // 計算可提領餘額
      const partnerEarnings = totalEarnings * (1 - PLATFORM_FEE_PERCENTAGE);
      const availableBalance = partnerEarnings + referralEarnings - totalWithdrawn;

      return {
        totalEarnings,
        totalOrders,
        availableBalance: Math.max(0, availableBalance),
        pendingWithdrawals,
        referralEarnings,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
        rank: rank || null
      };
    }, 'partners/withdrawal/stats');

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ 獲取提領統計時發生錯誤:', error);
    return createErrorResponse(error, 'partners/withdrawal/stats');
  }
}
