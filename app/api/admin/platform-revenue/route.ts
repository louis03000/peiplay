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
      // 1. 获取所有有金额的订单（与订单记录页面保持一致）
      // 注意：订单记录页面显示 ['CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED']
      // 但平台收入应该只计算真正已完成的订单（COMPLETED），因为这些订单才会产生平台抽成
      // 如果订单记录页面的总金额与平台收入不一致，说明有订单还未完成（状态不是COMPLETED）
      // 为了与订单记录页面保持一致，我们也查询这些状态的订单，但只计算有 finalAmount 的
      const where: any = {
        status: {
          in: ['CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED'],
        },
        finalAmount: {
          not: null,
          gt: 0,
        },
      }
      
      console.log(`📊 查询订单，过滤条件:`, filterMonth || '全部月份')

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
      // 注意：订单记录页面显示所有状态的订单（CONFIRMED, COMPLETED, PARTNER_ACCEPTED）
      // 但平台收入应该只计算已完成的订单（COMPLETED），因为这些订单才会产生平台抽成
      let totalAmount = 0
      for (const booking of completedBookings) {
        if (booking.finalAmount) {
          totalAmount += Number(booking.finalAmount)
        }
      }
      const basePlatformFee = totalAmount * 0.15
      
      // 添加调试日志
      console.log(`📊 平台收入计算: 已完成订单数 ${completedBookings.length}, 总金额 ${totalAmount.toFixed(2)}, 平台抽成 ${basePlatformFee.toFixed(2)}`)
      console.log(`📊 推荐奖励支出: ${totalReferralExpense.toFixed(2)}, 第一名减免: ${totalFirstPlaceDiscount.toFixed(2)}`)

      // 3. 计算推荐奖励支出
      // 查询所有推荐收入记录（ReferralEarning）
      // ReferralEarning 的 createdAt 对应推荐收入的创建时间（即订单完成时）
      // 所以应该根据 ReferralEarning.createdAt 来过滤，而不是 booking.updatedAt
      const referralEarningsWhere: any = {}
      
      if (filterMonth) {
        const [year, month] = filterMonth.split('-').map(Number)
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
        referralEarningsWhere.createdAt = {
          gte: startDate,
          lte: endDate,
        }
      }
      
      const referralEarnings = await client.referralEarning.findMany({
        where: referralEarningsWhere,
        select: {
          amount: true,
          createdAt: true,
        },
      })

      let totalReferralExpense = 0
      for (const earning of referralEarnings) {
        totalReferralExpense += Number(earning.amount)
      }
      
      // 添加调试日志
      console.log(`📊 推荐奖励记录: 找到 ${referralEarnings.length} 条记录，总金额 ${totalReferralExpense.toFixed(2)}`)
      
      // 如果没有推荐奖励记录，尝试检查是否有订单应该产生推荐奖励
      if (referralEarnings.length === 0 && completedBookings.length > 0) {
        console.log(`⚠️ 警告: 找到 ${completedBookings.length} 个已完成订单，但没有推荐奖励记录`)
        // 检查是否有推荐关系但未计算推荐奖励的订单
        const bookingsWithReferral = await client.booking.findMany({
          where: {
            ...where,
            schedule: {
              partner: {
                referralsReceived: {
                  isNot: null,
                },
              },
            },
          },
          select: {
            id: true,
            finalAmount: true,
            schedule: {
              select: {
                partner: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          take: 5, // 只取前5个作为示例
        })
        if (bookingsWithReferral.length > 0) {
          console.log(`📋 发现 ${bookingsWithReferral.length} 个订单有推荐关系但未计算推荐奖励`)
          console.log(`   示例订单: ${bookingsWithReferral.map(b => `ID=${b.id}, 伙伴=${b.schedule.partner.name}`).join(', ')}`)
          console.log(`   💡 建议: 在管理后台运行"批量重新計算推薦收入"功能`)
        }
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
        const bookingDate = new Date(booking.updatedAt)
        const weekStart = getWeekStartDate(bookingDate)
        // 标准化为UTC时间的00:00:00，确保与数据库存储的格式一致
        weekStart.setUTCHours(0, 0, 0, 0)
        
        // 查询该周的第一名（精确匹配 weekStartDate）
        // RankingHistory 表中的 weekStartDate 存储的就是那一周的周一 00:00:00 UTC
        const rankingHistory = await client.rankingHistory.findFirst({
          where: {
            weekStartDate: weekStart,
            rank: 1,
          },
          select: {
            partnerId: true,
            weekStartDate: true,
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
          console.log(`✅ 找到第一名减免: 订单 ${booking.id}, 伙伴 ${booking.schedule.partnerId}, 金额 ${Number(booking.finalAmount)}, 减免 ${discount.toFixed(2)}`)
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
            createdAt: {
              gte: monthStartDate,
              lte: monthEndDate,
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

          const bookingDate = new Date(booking.updatedAt)
          const weekStart = getWeekStartDate(bookingDate)
          weekStart.setUTCHours(0, 0, 0, 0)
          
          const rankingHistory = await client.rankingHistory.findFirst({
            where: {
              weekStartDate: weekStart,
              rank: 1,
            },
            select: {
              partnerId: true,
              weekStartDate: true,
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
