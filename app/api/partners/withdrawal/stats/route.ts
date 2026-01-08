import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { getPartnerLastWeekRank, calculatePlatformFeePercentage } from '@/lib/ranking-helpers'
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 優化：使用 Redis 快取提領統計（30秒快取，因為金額可能頻繁變動）
    const cacheKey = CacheKeys.stats.user(session.user.id) + ':withdrawal-stats';
    const result = await Cache.getOrSet(
      cacheKey,
      async () => {
        // 使用帶有重試機制的資料庫查詢
        return await db.query(async (client) => {
          // 檢查是否為夥伴
          const partner = await client.partner.findUnique({
            where: { userId: session.user.id },
            select: {
              id: true,
              referralEarnings: true,
              referralPlatformFee: true
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

          // 優先使用 referralPlatformFee 字段（如果管理員有手動設定）
          // 如果沒有設定，則使用排名計算的平台維護費
          let rank: number | null = null;
          let PLATFORM_FEE_PERCENTAGE = partner.referralPlatformFee / 100 || 0.15; // 優先使用 referralPlatformFee，默認 15%
          
          // 如果 referralPlatformFee 沒有設定（為 null 或 0），則使用排名計算
          if (!partner.referralPlatformFee || partner.referralPlatformFee === 0) {
            try {
              rank = await getPartnerLastWeekRank(partner.id);
              PLATFORM_FEE_PERCENTAGE = calculatePlatformFeePercentage(rank);
            } catch (error: any) {
              // 如果獲取排名失敗，使用默認費率
              console.warn('⚠️ 獲取排名失敗，使用默認費率:', error?.message || error);
              PLATFORM_FEE_PERCENTAGE = 0.15; // 默認 15%
            }
          }

          // 計算可提領餘額
          const partnerEarnings = totalEarnings * (1 - PLATFORM_FEE_PERCENTAGE);
          const availableBalance = partnerEarnings + referralEarnings - totalWithdrawn;

          return {
            totalEarnings: Math.round(totalEarnings),
            totalOrders,
            availableBalance: Math.max(0, Math.floor(availableBalance)), // 使用向下取整（捨去法）
            pendingWithdrawals,
            referralEarnings: Math.round(referralEarnings),
            platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
            rank: rank || null
          };
        }, 'partners/withdrawal/stats');
      },
      CacheTTL.SHORT // 30 秒快取
    );

    // 處理錯誤（如果快取中的結果是錯誤）
    if (result && typeof result === 'object' && 'error' in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    // 個人資料使用 private cache（只快取在用戶瀏覽器中）
    return NextResponse.json(
      result,
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    );

  } catch (error: any) {
    console.error('❌ 獲取提領統計時發生錯誤:', error);
    return createErrorResponse(error, 'partners/withdrawal/stats');
  }
}
