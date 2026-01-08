import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { getWeekStartDate } from '@/lib/ranking-helpers'

export const dynamic = 'force-dynamic'

/**
 * 计算平台总收入
 * 平台总收入 = (总金额 × 15%) - 推荐奖励支出 - 排行榜第一名减免
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // 检查是否为管理员
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filterMonth = searchParams.get('month') // 格式：YYYY-MM

    const result = await db.query(async (client) => {
      // 1. 获取所有已完成的订单
      const where: any = {
        status: 'COMPLETED',
      }

      // 如果指定了月份，过滤记录
      if (filterMonth) {
        // 计算月份的开始和结束日期
        const [year, month] = filterMonth.split('-').map(Number)
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
        
        where.updatedAt = {
          gte: startDate,
          lte: endDate,
        }
      }

      const completedBookings = await client.booking.findMany({
        where,
        select: {
          id: true,
          finalAmount: true,
          updatedAt: true, // 订单完成时间
          schedule: {
            select: {
              partnerId: true,
            },
          },
        },
      })

      // 2. 计算总金额和基础平台抽成（15%）
      let totalAmount = 0
      for (const booking of completedBookings) {
        if (booking.finalAmount) {
          totalAmount += Number(booking.finalAmount)
        }
      }
      const basePlatformFee = totalAmount * 0.15

      // 3. 计算推荐奖励支出
      // 查询所有推荐收入记录（ReferralEarning）
      const referralEarningsWhere: any = {
        booking: {
          status: 'COMPLETED',
        },
      }
      
      if (filterMonth) {
        const [year, month] = filterMonth.split('-').map(Number)
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
        referralEarningsWhere.booking.updatedAt = {
          gte: startDate,
          lte: endDate,
        }
      }
      
      const referralEarnings = await client.referralEarning.findMany({
        where: referralEarningsWhere,
        select: {
          amount: true,
        },
      })

      let totalReferralExpense = 0
      for (const earning of referralEarnings) {
        totalReferralExpense += Number(earning.amount)
      }

      // 4. 计算排行榜第一名减免
      // 需要按订单完成时间所在的那一周来确定该订单是否属于第一名
      let totalFirstPlaceDiscount = 0
      const firstPlaceBookings: Array<{ bookingId: string; amount: number; weekStart: string }> = []

      for (const booking of completedBookings) {
        if (!booking.finalAmount || !booking.updatedAt || !booking.schedule?.partnerId) {
          continue
        }

        // 获取订单完成时间所在的那一周的开始日期（周一）
        const weekStart = getWeekStartDate(new Date(booking.updatedAt))
        
        // 查询该周的第一名
        const rankingHistory = await client.rankingHistory.findFirst({
          where: {
            weekStartDate: weekStart,
            rank: 1,
          },
          select: {
            partnerId: true,
          },
        })

        // 如果该订单的伙伴是该周的第一名，计算减免
        if (rankingHistory && rankingHistory.partnerId === booking.schedule.partnerId) {
          const discount = Number(booking.finalAmount) * 0.02 // 2%
          totalFirstPlaceDiscount += discount
          firstPlaceBookings.push({
            bookingId: booking.id,
            amount: Number(booking.finalAmount),
            weekStart: weekStart.toISOString(),
          })
        }
      }

      // 5. 计算平台总收入
      const platformRevenue = basePlatformFee - totalReferralExpense - totalFirstPlaceDiscount

      // 6. 按月份分组计算
      const monthlyData: Record<string, {
        totalAmount: number
        basePlatformFee: number
        referralExpense: number
        firstPlaceDiscount: number
        platformRevenue: number
      }> = {}

      // 重新计算每个月的数据
      const bookingsByMonth: Record<string, typeof completedBookings> = {}
      for (const booking of completedBookings) {
        const monthKey = booking.updatedAt.toISOString().substring(0, 7) // YYYY-MM
        if (!bookingsByMonth[monthKey]) {
          bookingsByMonth[monthKey] = []
        }
        bookingsByMonth[monthKey].push(booking)
      }

      for (const [month, monthBookings] of Object.entries(bookingsByMonth)) {
        let monthTotalAmount = 0
        for (const booking of monthBookings) {
          if (booking.finalAmount) {
            monthTotalAmount += Number(booking.finalAmount)
          }
        }
        const monthBasePlatformFee = monthTotalAmount * 0.15

        // 该月的推荐奖励支出
        const [monthYear, monthMonth] = month.split('-').map(Number)
        const monthStartDate = new Date(Date.UTC(monthYear, monthMonth - 1, 1, 0, 0, 0, 0))
        const monthEndDate = new Date(Date.UTC(monthYear, monthMonth, 0, 23, 59, 59, 999))
        
        const monthReferralEarnings = await client.referralEarning.findMany({
          where: {
            booking: {
              status: 'COMPLETED',
              updatedAt: {
                gte: monthStartDate,
                lte: monthEndDate,
              },
            },
          },
          select: {
            amount: true,
          },
        })
        let monthReferralExpense = 0
        for (const earning of monthReferralEarnings) {
          monthReferralExpense += Number(earning.amount)
        }

        // 该月的第一名减免
        let monthFirstPlaceDiscount = 0
        for (const booking of monthBookings) {
          if (!booking.finalAmount || !booking.updatedAt || !booking.schedule?.partnerId) {
            continue
          }

          const weekStart = getWeekStartDate(new Date(booking.updatedAt))
          const rankingHistory = await client.rankingHistory.findFirst({
            where: {
              weekStartDate: weekStart,
              rank: 1,
            },
            select: {
              partnerId: true,
            },
          })

          if (rankingHistory && rankingHistory.partnerId === booking.schedule.partnerId) {
            monthFirstPlaceDiscount += Number(booking.finalAmount) * 0.02
          }
        }

        const monthPlatformRevenue = monthBasePlatformFee - monthReferralExpense - monthFirstPlaceDiscount

        monthlyData[month] = {
          totalAmount: monthTotalAmount,
          basePlatformFee: monthBasePlatformFee,
          referralExpense: monthReferralExpense,
          firstPlaceDiscount: monthFirstPlaceDiscount,
          platformRevenue: monthPlatformRevenue,
        }
      }

      return {
        total: {
          totalAmount,
          basePlatformFee,
          referralExpense: totalReferralExpense,
          firstPlaceDiscount: totalFirstPlaceDiscount,
          platformRevenue,
        },
        monthly: monthlyData,
        details: {
          firstPlaceBookingsCount: firstPlaceBookings.length,
        },
      }
    }, 'admin:platform-revenue')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error calculating platform revenue:', error)
    return NextResponse.json(
      { error: 'Failed to calculate platform revenue' },
      { status: 500 }
    )
  }
}
