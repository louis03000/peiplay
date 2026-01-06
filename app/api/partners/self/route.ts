import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { CacheInvalidation, Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({
        error: '未登入',
        partner: null,
      }, { status: 401 })
    }

    // 優化：如果 session 中已經有伙伴信息，直接返回（避免重複查詢）
    if (session.user.partnerId) {
      return NextResponse.json({
        partner: {
          id: session.user.partnerId,
          status: session.user.partnerStatus || null,
          // name 需要從資料庫查詢，但可以延遲加載
        }
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      })
    }

    // 優化：使用 Redis 快取（30秒快取，因為夥伴狀態可能變動）
    const cacheKey = CacheKeys.stats.user(session.user.id) + ':partner-self';
    const result = await Cache.getOrSet(
      cacheKey,
      async () => {
        // 優化：使用索引優化的查詢（Partner.userId 索引）
        return await db.query(async (client) => {
          const partner = await client.partner.findUnique({
            where: { userId: session.user.id },
            select: {
              id: true,
              name: true,
              status: true,
            },
          })
          
          const user = await client.user.findUnique({
            where: { id: session.user.id },
            select: {
              partnerRejectionCount: true,
            },
          })
          
          return {
            partner,
            partnerRejectionCount: user?.partnerRejectionCount || 0,
          }
        }, 'partners:self:get')
      },
      CacheTTL.SHORT // 30 秒快取
    )

    if (!result.partner) {
      return NextResponse.json({ 
        partner: null,
        partnerRejectionCount: result.partnerRejectionCount || 0,
      })
    }

    // 個人資料使用 private cache（只快取在用戶瀏覽器中）
    return NextResponse.json(
      { 
        partner: result.partner,
        partnerRejectionCount: result.partnerRejectionCount || 0,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    return createErrorResponse(error, 'partners:self:get')
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const payload = await request.json()
    const { isAvailableNow, isRankBooster, allowGroupBooking, rankBoosterNote, rankBoosterRank, customerMessage, availableNowSince } = payload

    const result = await db.query(async (client) => {
      const now = new Date()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
      
      // 先檢查並自動關閉超過30分鐘的「現在有空」狀態
      await client.partner.updateMany({
        where: {
          userId: session.user.id,
          isAvailableNow: true,
          availableNowSince: {
            lt: thirtyMinutesAgo
          }
        },
        data: {
          isAvailableNow: false,
          availableNowSince: null
        }
      })
      
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
      })

      if (!partner) {
        return { type: 'NOT_FOUND' } as const
      }

      // 如果嘗試開啟「現在有空」，檢查是否有活躍訂單
      if (isAvailableNow === true) {
        const activeBooking = await client.booking.findFirst({
          where: {
            schedule: {
              partnerId: partner.id,
              startTime: { lte: now },
              endTime: { gte: now }
            },
            status: {
              in: ['CONFIRMED', 'PARTNER_ACCEPTED']
            }
          }
        });

        if (activeBooking) {
          return { type: 'HAS_ACTIVE_BOOKING' } as const
        }
      }

      // 處理 availableNowSince：如果明確傳入 null，則設置為 null；如果傳入值，則轉換為 Date；否則保持原值
      let availableNowSinceValue: Date | null | undefined = undefined;
      if (availableNowSince !== undefined) {
        availableNowSinceValue = availableNowSince ? new Date(availableNowSince) : null;
      }

      const updatedPartner = await client.partner.update({
        where: { userId: session.user.id },
        data: {
          isAvailableNow: isAvailableNow ?? partner.isAvailableNow,
          isRankBooster: isRankBooster ?? partner.isRankBooster,
          allowGroupBooking: allowGroupBooking ?? partner.allowGroupBooking,
          rankBoosterNote: rankBoosterNote ?? partner.rankBoosterNote,
          rankBoosterRank: rankBoosterRank ?? partner.rankBoosterRank,
          customerMessage: customerMessage ?? partner.customerMessage,
          ...(availableNowSinceValue !== undefined ? { availableNowSince: availableNowSinceValue } : {}),
        },
      })

      return { type: 'SUCCESS', partner: updatedPartner } as const
    }, 'partners:self:update')

    // 清除相關快取
    if (result.type === 'SUCCESS') {
      console.log(`🔄 清除夥伴 ${result.partner.id} 的相關快取（更新「現在有空」狀態）`);
      await CacheInvalidation.onPartnerUpdate(result.partner.id);
      console.log(`✅ 已清除夥伴 ${result.partner.id} 的相關快取`);
    }

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '找不到夥伴資料' }, { status: 404 })
    }

    if (result.type === 'HAS_ACTIVE_BOOKING') {
      return NextResponse.json({ error: '您正在執行一筆訂單，請完成訂單後再進行操作' }, { status: 400 })
    }

    return NextResponse.json({ partner: result.partner })
  } catch (error) {
    return createErrorResponse(error, 'partners:self:update')
  }
} 