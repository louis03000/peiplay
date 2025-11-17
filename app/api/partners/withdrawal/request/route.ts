import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { getPartnerLastWeekRank, calculatePlatformFeePercentage } from '@/lib/ranking-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { amount } = await request.json()
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: '請輸入有效的提領金額' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        include: {
          user: true,
        },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      // 獲取夥伴上一週的排名並計算平台維護費
      // 本週的排名決定下週的減免，所以計算當前週的費用時，需要查詢上一週的排名
      const rank = await getPartnerLastWeekRank(partner.id)
      const PLATFORM_FEE_PERCENTAGE = calculatePlatformFeePercentage(rank)

      const [totalEarnings, totalWithdrawn] = await Promise.all([
        client.booking.aggregate({
          where: {
            schedule: { partnerId: partner.id },
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
          _sum: { finalAmount: true },
        }),
        client.withdrawalRequest.aggregate({
          where: {
            partnerId: partner.id,
            status: { in: ['APPROVED', 'COMPLETED'] },
          },
          _sum: { amount: true },
        }),
      ])

      const partnerData = await client.partner.findUnique({
        where: { id: partner.id },
        select: { referralEarnings: true },
      })

      const totalEarningsAmount = totalEarnings._sum.finalAmount || 0
      const totalWithdrawnAmount = totalWithdrawn._sum.amount || 0
      const referralEarnings = partnerData?.referralEarnings || 0
      const partnerEarnings = totalEarningsAmount * (1 - PLATFORM_FEE_PERCENTAGE)
      const availableBalance = partnerEarnings + referralEarnings - totalWithdrawnAmount

      if (amount > availableBalance) {
        return { type: 'EXCEEDS_BALANCE', availableBalance } as const
      }

      const pendingCount = await client.withdrawalRequest.count({
        where: { partnerId: partner.id, status: 'PENDING' },
      })

      if (pendingCount > 0) {
        return { type: 'PENDING_EXISTS' } as const
      }

      const withdrawalRequest = await client.withdrawalRequest.create({
        data: {
          partnerId: partner.id,
          amount,
          status: 'PENDING',
          requestedAt: new Date(),
        },
      })

      const [totalOrders, recentBookings] = await Promise.all([
        client.booking.count({
          where: {
            schedule: { partnerId: partner.id },
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
        }),
        client.booking.findMany({
          where: {
            schedule: { partnerId: partner.id },
            status: { in: ['COMPLETED', 'CONFIRMED'] },
          },
          include: {
            customer: { include: { user: true } },
            schedule: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

      console.log('💰 新的提領申請:', {
        partnerId: partner.id,
        partnerName: partner.name,
        amount,
        totalEarnings: totalEarningsAmount,
        totalOrders,
        availableBalance,
        recentBookings: recentBookings.map((b) => ({
          orderNumber: b.orderNumber,
          customerName: b.customer.user.name,
          amount: b.finalAmount,
          date: b.createdAt,
        })),
      })

      return {
        type: 'SUCCESS',
        withdrawalRequest,
      } as const
    }, 'partners:withdrawal:request')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
      case 'EXCEEDS_BALANCE':
        return NextResponse.json({
          error: `提領金額不能超過可用餘額 NT$ ${result.availableBalance.toLocaleString()}`,
        }, { status: 400 })
      case 'PENDING_EXISTS':
        return NextResponse.json({
          error: '您已有待審核的提領申請，請等待審核完成後再申請',
        }, { status: 400 })
      case 'SUCCESS':
        return NextResponse.json({
          success: true,
          withdrawalRequest: {
            id: result.withdrawalRequest.id,
            amount: result.withdrawalRequest.amount,
            status: result.withdrawalRequest.status,
            requestedAt: result.withdrawalRequest.requestedAt.toISOString(),
          },
          message: '提領申請已提交，管理員將盡快審核',
        })
      default:
        return NextResponse.json({ error: '未知狀態' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partners:withdrawal:request')
  }
}
