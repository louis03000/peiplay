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
      const totalEarnings = referralEarnings._sum.amount || 0
      const currentEarnings = partner.referralEarnings || 0

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
            totalEarnings,
            currentEarnings,
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

