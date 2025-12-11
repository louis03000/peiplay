import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { CacheInvalidation } from '@/lib/redis-cache'

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
      })
    }

    // 優化：使用索引優化的查詢（Partner.userId 索引）
    // 移除 updateMany 操作（這個操作很慢，應該移到後台任務或只在需要時執行）
    const partner = await db.query(async (client) => {
      return client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          name: true,
          status: true,
        },
      })
    }, 'partners:self:get')

    if (!partner) {
      return NextResponse.json({ partner: null })
    }

    // 個人資料使用 private cache（只快取在用戶瀏覽器中）
    return NextResponse.json(
      { partner },
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

      const updatedPartner = await client.partner.update({
        where: { userId: session.user.id },
        data: {
          isAvailableNow: isAvailableNow ?? partner.isAvailableNow,
          isRankBooster: isRankBooster ?? partner.isRankBooster,
          allowGroupBooking: allowGroupBooking ?? partner.allowGroupBooking,
          rankBoosterNote: rankBoosterNote ?? partner.rankBoosterNote,
          rankBoosterRank: rankBoosterRank ?? partner.rankBoosterRank,
          customerMessage: customerMessage ?? partner.customerMessage,
          availableNowSince: availableNowSince ? new Date(availableNowSince) : partner.availableNowSince,
        },
      })

      return { type: 'SUCCESS', partner: updatedPartner } as const
    }, 'partners:self:update')

    // 清除相關快取
    if (result.type === 'SUCCESS') {
      await CacheInvalidation.onPartnerUpdate(result.partner.id);
    }

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '找不到夥伴資料' }, { status: 404 })
    }

    return NextResponse.json({ partner: result.partner })
  } catch (error) {
    return createErrorResponse(error, 'partners:self:update')
  }
} 