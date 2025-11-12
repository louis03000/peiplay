import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({ where: { id: session.user.id } })
      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      const pendingWithdrawals = await client.withdrawalRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          partner: {
            include: { user: true },
          },
        },
        orderBy: { requestedAt: 'asc' },
      })

      const PLATFORM_FEE_PERCENTAGE = 0.15

      const withdrawalsWithStats = await Promise.all(
        pendingWithdrawals.map(async (withdrawal) => {
          const [totalEarnings, totalOrders, recentBookings, totalWithdrawn, partnerData] = await Promise.all([
            client.booking.aggregate({
              where: {
                schedule: { partnerId: withdrawal.partnerId },
                status: { in: ['COMPLETED', 'CONFIRMED'] },
              },
              _sum: { finalAmount: true },
            }),
            client.booking.count({
              where: {
                schedule: { partnerId: withdrawal.partnerId },
                status: { in: ['COMPLETED', 'CONFIRMED'] },
              },
            }),
            client.booking.findMany({
              where: {
                schedule: { partnerId: withdrawal.partnerId },
                status: { in: ['COMPLETED', 'CONFIRMED'] },
              },
              include: {
                customer: { include: { user: true } },
                schedule: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            }),
            client.withdrawalRequest.aggregate({
              where: {
                partnerId: withdrawal.partnerId,
                status: { in: ['APPROVED', 'COMPLETED'] },
              },
              _sum: { amount: true },
            }),
            client.partner.findUnique({
              where: { id: withdrawal.partnerId },
              select: { referralEarnings: true },
            }),
          ])

          const totalEarningsAmount = totalEarnings._sum.finalAmount || 0
          const totalWithdrawnAmount = totalWithdrawn._sum.amount || 0
          const referralEarnings = partnerData?.referralEarnings || 0
          const partnerEarnings = totalEarningsAmount * (1 - PLATFORM_FEE_PERCENTAGE)
          const availableBalance = partnerEarnings + referralEarnings - totalWithdrawnAmount

          return {
            id: withdrawal.id,
            partnerId: withdrawal.partnerId,
            partnerName: withdrawal.partner.name,
            partnerEmail: withdrawal.partner.user.email,
            amount: withdrawal.amount,
            requestedAt: withdrawal.requestedAt,
            stats: {
              totalEarnings: totalEarningsAmount,
              totalOrders,
              availableBalance,
              recentBookings: recentBookings.map((booking) => ({
                orderNumber: booking.orderNumber,
                customerName: booking.customer.user.name,
                amount: booking.finalAmount,
                date: booking.createdAt,
                startTime: booking.schedule.startTime,
                endTime: booking.schedule.endTime,
              })),
            },
          }
        })
      )

      return { type: 'SUCCESS', withdrawalsWithStats }
    }, 'admin:withdrawal-notifications:get')

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    return NextResponse.json({
      pendingWithdrawals: result.withdrawalsWithStats,
      total: result.withdrawalsWithStats.length,
    })
  } catch (error) {
    return createErrorResponse(error, 'admin:withdrawal-notifications:get')
  }
}
