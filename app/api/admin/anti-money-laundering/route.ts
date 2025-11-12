import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const RISK_RULES = {
  HIGH_FREQUENCY: {
    threshold: 10,
    timeWindow: 24 * 60 * 60 * 1000,
    riskScore: 50,
  },
  SUSPICIOUS_AMOUNTS: {
    minAmount: 1000,
    maxAmount: 50000,
    riskScore: 30,
  },
  REPEAT_CUSTOMER: {
    threshold: 5,
    timeWindow: 24 * 60 * 60 * 1000,
    riskScore: 40,
  },
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = Number.isNaN(Number(searchParams.get('days'))) ? 7 : parseInt(searchParams.get('days') || '7', 10)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const result = await db.query(async (client) => {
      const admin = await client.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
      if (!admin || admin.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      const bookings = await client.booking.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
          status: {
            in: ['CONFIRMED', 'COMPLETED'],
          },
        },
        include: {
          schedule: {
            include: {
              partner: true,
            },
          },
          customer: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return { type: 'SUCCESS', bookings } as const
    }, 'admin:aml:get')

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const suspiciousTransactions: Array<{
      bookingId: string
      partnerName: string | null
      customerName: string | null
      amount: number | null
      createdAt: Date
      riskScore: number
      reasons: string[]
    }> = []

    for (const booking of result.bookings) {
      let riskScore = 0
      const reasons: string[] = []
      const amount = booking.finalAmount || 0
      const now = Date.now()

      const partnerRecentBookings = result.bookings.filter(
        (b) =>
          b.schedule.partnerId === booking.schedule.partnerId &&
          b.id !== booking.id &&
          new Date(b.createdAt).getTime() > now - RISK_RULES.HIGH_FREQUENCY.timeWindow
      )

      if (partnerRecentBookings.length >= RISK_RULES.HIGH_FREQUENCY.threshold) {
        riskScore += RISK_RULES.HIGH_FREQUENCY.riskScore
        reasons.push(`高頻交易：24小時內${partnerRecentBookings.length + 1}筆交易`)
      }

      if (amount >= RISK_RULES.SUSPICIOUS_AMOUNTS.minAmount && amount <= RISK_RULES.SUSPICIOUS_AMOUNTS.maxAmount) {
        riskScore += RISK_RULES.SUSPICIOUS_AMOUNTS.riskScore
        reasons.push(`異常金額：${amount}元`)
      }

      const customerRecentBookings = result.bookings.filter(
        (b) =>
          b.customerId === booking.customerId &&
          b.id !== booking.id &&
          new Date(b.createdAt).getTime() > now - RISK_RULES.REPEAT_CUSTOMER.timeWindow
      )

      if (customerRecentBookings.length >= RISK_RULES.REPEAT_CUSTOMER.threshold) {
        riskScore += RISK_RULES.REPEAT_CUSTOMER.riskScore
        reasons.push(`重複客戶：24小時內${customerRecentBookings.length + 1}筆交易`)
      }

      if (riskScore >= 30) {
        suspiciousTransactions.push({
          bookingId: booking.id,
          partnerName: booking.schedule?.partner?.name ?? null,
          customerName: booking.customer?.name ?? null,
          amount: booking.finalAmount,
          createdAt: booking.createdAt,
          riskScore,
          reasons,
        })
      }
    }

    const totalTransactions = result.bookings.length
    const totalAmount = result.bookings.reduce((sum, b) => sum + (b.finalAmount || 0), 0)
    const suspiciousCount = suspiciousTransactions.length
    const highRiskCount = suspiciousTransactions.filter((t) => t.riskScore >= 70).length

    return NextResponse.json({
      summary: {
        totalTransactions,
        totalAmount,
        suspiciousCount,
        highRiskCount,
        riskRate: totalTransactions > 0 ? (suspiciousCount / totalTransactions * 100).toFixed(2) : '0',
      },
      suspiciousTransactions: suspiciousTransactions.sort((a, b) => b.riskScore - a.riskScore),
    })
  } catch (error) {
    return createErrorResponse(error, 'admin:aml:get')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { bookingId, action, reason } = await request.json()

    if (!bookingId || !action) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const admin = await client.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
      if (!admin || admin.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      await client.booking.update({
        where: { id: bookingId },
        data: {
          status: action === 'BLOCK' ? 'CANCELLED' : 'CONFIRMED',
          paymentError: action === 'BLOCK' ? `反洗錢封鎖：${reason ?? '無理由'}` : null,
        },
      })

      return { type: 'SUCCESS' } as const
    }, 'admin:aml:update')

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    return NextResponse.json({ message: `交易已${action === 'BLOCK' ? '封鎖' : '放行'}` })
  } catch (error) {
    return createErrorResponse(error, 'admin:aml:update')
  }
} 