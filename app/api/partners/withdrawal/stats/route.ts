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

          // 檢查是否為被推薦夥伴（被推薦夥伴永遠獲得85%收益）
          const referralRecord = await client.referralRecord.findUnique({
            where: { inviteeId: partner.id }
          });
          
          const isReferredPartner = !!referralRecord;

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

          // 🔥 被推薦夥伴基礎收益是85%（100% - 15%平台抽成）
          // 但排名優惠仍然要加上去（第一名+2%，第二三名+1%）
          // 推薦獎勵從平台維護費中扣除，不影響被推薦夥伴的收益
          let rank: number | null = null;
          let PLATFORM_FEE_PERCENTAGE = 0.15; // 默認 15%
          let rankDiscount = 0; // 排名優惠
          
          // 獲取排名（無論是否被推薦，都需要排名來計算優惠）
          try {
            rank = await getPartnerLastWeekRank(partner.id);
            rankDiscount = getPlatformFeeDiscount(rank);
          } catch (error: any) {
            console.warn('⚠️ 獲取排名失敗:', error?.message || error);
            rank = null;
            rankDiscount = 0;
          }
          
          if (isReferredPartner) {
            // 被推薦夥伴：基礎收益85%，加上排名優惠
            // 例如：第一名 = 85% + 2% = 87%
            // 例如：第二名 = 85% + 1% = 86%
            // 平台抽成 = 15% - 排名優惠
            PLATFORM_FEE_PERCENTAGE = 0.15 - rankDiscount;
          } else {
            // 非被推薦夥伴：使用排名系統或 referralPlatformFee
            if (partner.referralPlatformFee && partner.referralPlatformFee > 0) {
              PLATFORM_FEE_PERCENTAGE = partner.referralPlatformFee / 100;
            } else {
              PLATFORM_FEE_PERCENTAGE = calculatePlatformFeePercentage(rank);
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
