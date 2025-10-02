import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export const dynamic = 'force-dynamic';
// 洗錢風險檢測規則
const RISK_RULES = {
  // 短時間內大量交易
  HIGH_FREQUENCY: {
    threshold: 10, // 24小時內超過10筆交易
    timeWindow: 24 * 60 * 60 * 1000, // 24小時
    riskScore: 50
  },
  // 異常金額模式
  SUSPICIOUS_AMOUNTS: {
    minAmount: 1000, // 最小可疑金額
    maxAmount: 50000, // 最大可疑金額
    riskScore: 30
  },
  // 同一客戶重複交易
  REPEAT_CUSTOMER: {
    threshold: 5, // 同一客戶24小時內超過5筆
    timeWindow: 24 * 60 * 60 * 1000,
    riskScore: 40
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    // 檢查是否為管理員
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 獲取所有交易
    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: {
          gte: startDate
        },
        status: {
          in: ['CONFIRMED', 'COMPLETED']
        }
      },
      include: {
        schedule: {
          include: {
            partner: true
          }
        },
        customer: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 分析可疑交易
    const suspiciousTransactions = []

    for (const booking of bookings) {
      let riskScore = 0
      const reasons = []

      // 檢查高頻交易
      const partnerRecentBookings = bookings.filter(b => 
        b.schedule.partnerId === booking.schedule.partnerId &&
        b.id !== booking.id &&
        new Date(b.createdAt).getTime() > new Date().getTime() - RISK_RULES.HIGH_FREQUENCY.timeWindow
      )

      if (partnerRecentBookings.length >= RISK_RULES.HIGH_FREQUENCY.threshold) {
        riskScore += RISK_RULES.HIGH_FREQUENCY.riskScore
        reasons.push(`高頻交易：24小時內${partnerRecentBookings.length + 1}筆交易`)
      }

      // 檢查異常金額
      const amount = booking.finalAmount || 0
      if (amount >= RISK_RULES.SUSPICIOUS_AMOUNTS.minAmount && 
          amount <= RISK_RULES.SUSPICIOUS_AMOUNTS.maxAmount) {
        riskScore += RISK_RULES.SUSPICIOUS_AMOUNTS.riskScore
        reasons.push(`異常金額：${amount}元`)
      }

      // 檢查重複客戶
      const customerRecentBookings = bookings.filter(b => 
        b.customerId === booking.customerId &&
        b.id !== booking.id &&
        new Date(b.createdAt).getTime() > new Date().getTime() - RISK_RULES.REPEAT_CUSTOMER.timeWindow
      )

      if (customerRecentBookings.length >= RISK_RULES.REPEAT_CUSTOMER.threshold) {
        riskScore += RISK_RULES.REPEAT_CUSTOMER.riskScore
        reasons.push(`重複客戶：24小時內${customerRecentBookings.length + 1}筆交易`)
      }

      // 如果風險分數超過閾值，標記為可疑
      if (riskScore >= 30) {
        suspiciousTransactions.push({
          bookingId: booking.id,
          partnerName: booking.schedule.partner.name,
          customerName: booking.customer.name,
          amount: booking.finalAmount,
          createdAt: booking.createdAt,
          riskScore,
          reasons
        })
      }
    }

    // 統計數據
    const totalTransactions = bookings.length
    const totalAmount = bookings.reduce((sum, b) => sum + (b.finalAmount || 0), 0)
    const suspiciousCount = suspiciousTransactions.length
    const highRiskCount = suspiciousTransactions.filter(t => t.riskScore >= 70).length

    return NextResponse.json({
      summary: {
        totalTransactions,
        totalAmount,
        suspiciousCount,
        highRiskCount,
        riskRate: totalTransactions > 0 ? (suspiciousCount / totalTransactions * 100).toFixed(2) : 0
      },
      suspiciousTransactions: suspiciousTransactions.sort((a, b) => b.riskScore - a.riskScore)
    })

  } catch (error) {
    console.error('Error in anti-money laundering check:', error)
    return NextResponse.json(
      { error: '反洗錢檢查失敗' },
      { status: 500 }
    )
  }
}

// 手動標記可疑交易
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

    // 更新預約狀態
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: action === 'BLOCK' ? 'CANCELLED' : 'CONFIRMED',
        paymentError: action === 'BLOCK' ? `反洗錢封鎖：${reason}` : null
      }
    })

    return NextResponse.json({ 
      message: `交易已${action === 'BLOCK' ? '封鎖' : '放行'}` 
    })

  } catch (error) {
    console.error('Error updating transaction status:', error)
    return NextResponse.json(
      { error: '更新交易狀態失敗' },
      { status: 500 }
    )
  }
} 