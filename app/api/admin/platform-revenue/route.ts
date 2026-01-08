import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { getWeekStartDate } from '@/lib/ranking-helpers'

export const dynamic = 'force-dynamic'

/**
 * 計算平台總收入
 * 平台總收入 = (總金額 × 15%) - 推薦獎勵支出 - 排行榜第一名減免
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // 檢查是否為管理員
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filterMonth = searchParams.get('month') // 格式：YYYY-MM

    const result = await db.query(async (client) => {
      // 1. 獲取所有有金額的訂單（與訂單記錄頁面保持一致）
      // 注意：訂單記錄頁面顯示 ['CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED']
      // 但平台收入應該只計算真正已完成的訂單（COMPLETED），因為這些訂單才會產生平台抽成
      // 如果訂單記錄頁面的總金額與平台收入不一致，說明有訂單還未完成（狀態不是COMPLETED）
      // 為了與訂單記錄頁面保持一致，我們也查詢這些狀態的訂單，但只計算有 finalAmount 的
      const where: any = {
        status: {
          in: ['CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED'],
        },
        finalAmount: {
          not: null,
          gt: 0,
        },
      }
      
      console.log(`📊 查詢訂單，過濾條件:`, filterMonth || '全部月份')

      // 如果指定了月份，過濾記錄
      if (filterMonth) {
        // 計算月份的開始和結束日期
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
          updatedAt: true, // 訂單完成時間
          schedule: {
            select: {
              partnerId: true,
            },
          },
        },
      })

      // 2. 計算總金額和基礎平台抽成（15%）
      // 注意：訂單記錄頁面顯示所有狀態的訂單（CONFIRMED, COMPLETED, PARTNER_ACCEPTED）
      // 但平台收入應該只計算已完成的訂單（COMPLETED），因為這些訂單才會產生平台抽成
      let totalAmount = 0
      for (const booking of completedBookings) {
        if (booking.finalAmount) {
          totalAmount += Number(booking.finalAmount)
        }
      }
      const basePlatformFee = totalAmount * 0.15
      
      // 添加調試日誌
      console.log(`📊 平台收入計算: 已完成訂單數 ${completedBookings.length}, 總金額 ${totalAmount.toFixed(2)}, 平台抽成 ${basePlatformFee.toFixed(2)}`)

      // 3. 計算推薦獎勵支出
      // 查詢所有推薦收入記錄（ReferralEarning）
      // ReferralEarning 的 createdAt 對應推薦收入的創建時間（即訂單完成時）
      // 所以應該根據 ReferralEarning.createdAt 來過濾，而不是 booking.updatedAt
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
      
      // 添加調試日誌
      console.log(`📊 推薦獎勵記錄: 找到 ${referralEarnings.length} 條記錄，總金額 ${totalReferralExpense.toFixed(2)}`)
      
      // 如果沒有推薦獎勵記錄，嘗試檢查是否有訂單應該產生推薦獎勵
      if (referralEarnings.length === 0 && completedBookings.length > 0) {
        console.log(`⚠️ 警告: 找到 ${completedBookings.length} 個已完成訂單，但沒有推薦獎勵記錄`)
        // 檢查是否有推薦關係但未計算推薦獎勵的訂單
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
          take: 5, // 只取前5個作為示例
        })
        if (bookingsWithReferral.length > 0) {
          console.log(`📋 發現 ${bookingsWithReferral.length} 個訂單有推薦關係但未計算推薦獎勵`)
          console.log(`   示例訂單: ${bookingsWithReferral.map(b => `ID=${b.id}, 夥伴=${b.schedule.partner.name}`).join(', ')}`)
          console.log(`   💡 建議: 在管理後台運行"批量重新計算推薦收入"功能`)
        }
      }

      // 4. 計算排行榜第一名減免
      // 需要按訂單完成時間所在的那一週來確定該訂單是否屬於第一名
      let totalFirstPlaceDiscount = 0
      const firstPlaceBookings: Array<{ bookingId: string; amount: number; weekStart: string }> = []

      for (const booking of completedBookings) {
        if (!booking.finalAmount || !booking.updatedAt || !booking.schedule?.partnerId) {
          continue
        }

        // 獲取訂單完成時間所在的那一週的開始日期（週一）
        const bookingDate = new Date(booking.updatedAt)
        const weekStart = getWeekStartDate(bookingDate)
        // 標準化為UTC時間的00:00:00，確保與資料庫存儲的格式一致
        weekStart.setUTCHours(0, 0, 0, 0)
        
        // 查詢該週的第一名（精確匹配 weekStartDate）
        // RankingHistory 表中的 weekStartDate 存儲的就是那一週的週一 00:00:00 UTC
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

        // 如果該訂單的夥伴是該週的第一名，計算減免
        if (rankingHistory && rankingHistory.partnerId === booking.schedule.partnerId) {
          const discount = Number(booking.finalAmount) * 0.02 // 2%
          totalFirstPlaceDiscount += discount
          firstPlaceBookings.push({
            bookingId: booking.id,
            amount: Number(booking.finalAmount),
            weekStart: weekStart.toISOString(),
          })
          console.log(`✅ 找到第一名減免: 訂單 ${booking.id}, 夥伴 ${booking.schedule.partnerId}, 金額 ${Number(booking.finalAmount)}, 減免 ${discount.toFixed(2)}`)
        }
      }

      // 添加調試日誌
      console.log(`📊 推薦獎勵支出: ${totalReferralExpense.toFixed(2)}, 第一名減免: ${totalFirstPlaceDiscount.toFixed(2)}`)
      
      // 5. 計算平台總收入
      const platformRevenue = basePlatformFee - totalReferralExpense - totalFirstPlaceDiscount

      // 6. 按月份分組計算
      const monthlyData: Record<string, {
        totalAmount: number
        basePlatformFee: number
        referralExpense: number
        firstPlaceDiscount: number
        platformRevenue: number
      }> = {}

      // 重新計算每個月的數據
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

        // 該月的推薦獎勵支出
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

        // 該月的第一名減免
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
