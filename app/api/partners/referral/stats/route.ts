import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          name: true,
          inviteCode: true,
          referralCount: true,
          referralEarnings: true,
          totalReferralEarnings: true,
        },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const [referralStats, recentReferrals, referralEarnings] = await Promise.all([
        client.referralRecord.findMany({
          where: { inviterId: partner.id },
          include: {
            invitee: {
              include: {
                user: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        client.referralEarning.findMany({
          where: { referralRecord: { inviterId: partner.id } },
          include: {
            referralRecord: {
              include: {
                invitee: true,
              },
            },
            booking: {
              include: {
                schedule: {
                  include: {
                    partner: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        client.referralEarning.aggregate({
          where: { referralRecord: { inviterId: partner.id } },
          _sum: { amount: true },
        }),
      ])

      const totalReferrals = referralStats.length
      let totalEarnings = referralEarnings._sum.amount || 0
      let currentEarnings = partner.referralEarnings || 0
      
      // 🔥 檢查數據一致性：如果 totalEarnings 和 currentEarnings 不一致，修復數據
      // 使用 totalEarnings 作為真實值，因為它來自 ReferralEarning 表的聚合
      if (Math.abs(totalEarnings - currentEarnings) > 0.01) {
        console.warn(`⚠️ [推薦統計] 數據不一致: 夥伴 ${partner.id} (${partner.name})`, {
          totalEarningsFromDB: totalEarnings,
          currentEarningsFromPartner: currentEarnings,
          difference: totalEarnings - currentEarnings,
        });
        
        // 🔥 修復數據：如果 totalEarnings > currentEarnings，說明有推薦收入沒有被正確更新到 Partner 表
        // 更新 Partner 表的 referralEarnings 字段
        if (totalEarnings > currentEarnings) {
          console.log(`🔧 [推薦統計] 修復數據不一致: 更新 Partner.referralEarnings 從 ${currentEarnings} 到 ${totalEarnings}`);
          await client.partner.update({
            where: { id: partner.id },
            data: {
              referralEarnings: totalEarnings,
            },
          });
          currentEarnings = totalEarnings;
        }
      }
      
      // 🔥 注意：這裡不再依賴任何 Cron
      // 推薦收入在「訂單狀態變成 COMPLETED」時即時計算並寫入 ReferralEarning
      // 此 API 每次被呼叫時，只負責做一次「對帳」，確保 Partner.referralEarnings 與 ReferralEarning 聚合結果一致

      const referrals = referralStats.map((record) => ({
        id: record.id,
        inviteeName: record.invitee.name,
        inviteeEmail: record.invitee.user.email,
        createdAt: record.createdAt,
        inviteCode: record.inviteCode,
      }))

      const earnings = recentReferrals.map((earning) => ({
        id: earning.id,
        amount: earning.amount,
        percentage: earning.percentage,
        createdAt: earning.createdAt,
        bookingId: earning.bookingId,
        inviteeName: earning.referralRecord?.invitee?.name || '未知',
      }))

      return {
        type: 'SUCCESS',
        payload: {
          partner: {
            id: partner.id,
            name: partner.name,
            inviteCode: partner.inviteCode,
            referralCount: partner.referralCount,
            referralEarnings: currentEarnings,
            totalReferralEarnings: partner.totalReferralEarnings,
          },
          stats: {
            totalReferrals,
            totalEarnings: totalEarnings, // 從 ReferralEarning 表聚合的總收入
            currentEarnings: currentEarnings, // 從 Partner.referralEarnings 字段獲取的可提領收入（已修復）
          },
          referrals,
          earnings,
        },
      } as const
    }, 'partners:referral:stats')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    return NextResponse.json(result.payload)
  } catch (error) {
    return createErrorResponse(error, 'partners:referral:stats')
  }
}

