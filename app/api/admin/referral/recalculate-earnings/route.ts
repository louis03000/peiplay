import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * 批量重新計算推薦收入
 * 查找所有已完成的訂單，檢查哪些還沒有計算推薦收入，然後批量計算
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      partnerId, // 可選：只處理特定夥伴的訂單
      startDate, // 可選：只處理指定日期之後的訂單
      endDate, // 可選：只處理指定日期之前的訂單
      forceRecalculate = false // 是否強制重新計算（即使已經計算過）
    } = body

    const result = await db.query(async (client) => {
      // 構建查詢條件：查找所有已完成的訂單
      const where: any = {
        status: BookingStatus.COMPLETED,
        finalAmount: {
          not: null,
          gt: 0, // 金額必須大於 0
        },
      }

      // 如果指定了夥伴 ID，只處理該夥伴的訂單
      if (partnerId) {
        where.schedule = {
          partnerId: partnerId,
        }
      }

      // 如果指定了日期範圍
      if (startDate || endDate) {
        if (!where.schedule) {
          where.schedule = {}
        }
        if (startDate) {
          where.schedule.startTime = {
            ...where.schedule.startTime,
            gte: new Date(startDate),
          }
        }
        if (endDate) {
          where.schedule.startTime = {
            ...where.schedule.startTime,
            lte: new Date(endDate),
          }
        }
      }

      // 查找所有符合條件的訂單
      const completedBookings = await client.booking.findMany({
        where,
        include: {
          schedule: {
            include: {
              partner: {
                include: {
                  referralsReceived: {
                    include: {
                      inviter: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      console.log(`🔍 找到 ${completedBookings.length} 個已完成的訂單`)

      // 檢查哪些訂單還沒有計算推薦收入
      const bookingsToProcess: typeof completedBookings = []
      const alreadyCalculated: string[] = []
      const noReferral: string[] = []
      const zeroAmount: string[] = []

      for (const booking of completedBookings) {
        // 檢查是否已經計算過推薦收入
        if (!forceRecalculate) {
          const existingEarning = await client.referralEarning.findFirst({
            where: {
              bookingId: booking.id,
            },
          })

          if (existingEarning) {
            alreadyCalculated.push(booking.id)
            continue
          }
        }

        // 檢查是否有推薦關係
        if (!booking.schedule?.partner?.referralsReceived) {
          noReferral.push(booking.id)
          continue
        }

        // 檢查金額
        if (!booking.finalAmount || booking.finalAmount <= 0) {
          zeroAmount.push(booking.id)
          continue
        }

        bookingsToProcess.push(booking)
      }

      console.log(`📊 統計:`)
      console.log(`   - 需要處理: ${bookingsToProcess.length} 個訂單`)
      console.log(`   - 已計算過: ${alreadyCalculated.length} 個訂單`)
      console.log(`   - 無推薦關係: ${noReferral.length} 個訂單`)
      console.log(`   - 金額為 0: ${zeroAmount.length} 個訂單`)

      // 批量計算推薦收入
      const results = {
        success: [] as Array<{ bookingId: string; amount: number; inviterName: string }>,
        failed: [] as Array<{ bookingId: string; error: string }>,
        skipped: [] as Array<{ bookingId: string; reason: string }>,
      }

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

      for (const booking of bookingsToProcess) {
        try {
          // 調用推薦收入計算 API
          const response = await fetch(`${baseUrl}/api/partners/referral/calculate-earnings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId: booking.id }),
          })

          const data = await response.json()

          if (response.ok && data.referralEarning !== undefined) {
            const referralRecord = booking.schedule?.partner?.referralsReceived
            const inviterName = referralRecord?.inviter?.name || '未知'

            results.success.push({
              bookingId: booking.id,
              amount: data.referralEarning || 0,
              inviterName,
            })

            console.log(`✅ 訂單 ${booking.id} 推薦收入計算成功: NT$ ${data.referralEarning}`)
          } else {
            results.failed.push({
              bookingId: booking.id,
              error: data.error || data.message || '計算失敗',
            })
            console.warn(`⚠️ 訂單 ${booking.id} 推薦收入計算失敗:`, data)
          }
        } catch (error: any) {
          results.failed.push({
            bookingId: booking.id,
            error: error.message || '計算錯誤',
          })
          console.error(`❌ 訂單 ${booking.id} 推薦收入計算錯誤:`, error)
        }
      }

      // 添加跳過的訂單信息
      for (const bookingId of alreadyCalculated) {
        results.skipped.push({
          bookingId,
          reason: '已計算過',
        })
      }

      for (const bookingId of noReferral) {
        results.skipped.push({
          bookingId,
          reason: '無推薦關係',
        })
      }

      for (const bookingId of zeroAmount) {
        results.skipped.push({
          bookingId,
          reason: '金額為 0',
        })
      }

      return {
        totalBookings: completedBookings.length,
        processed: bookingsToProcess.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results,
        summary: {
          alreadyCalculated: alreadyCalculated.length,
          noReferral: noReferral.length,
          zeroAmount: zeroAmount.length,
        },
      }
    }, 'admin:referral:recalculate-earnings')

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('批量重新計算推薦收入錯誤:', error)
    return createErrorResponse(error, 'admin:referral:recalculate-earnings')
  }
}

/**
 * 獲取推薦收入計算統計信息
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')

    const result = await db.query(async (client) => {
      // 構建查詢條件
      const where: any = {
        status: BookingStatus.COMPLETED,
        finalAmount: {
          not: null,
          gt: 0,
        },
      }

      if (partnerId) {
        where.schedule = {
          partnerId: partnerId,
        }
      }

      // 查找所有已完成的訂單
      const completedBookings = await client.booking.findMany({
        where,
        select: {
          id: true,
          finalAmount: true,
          createdAt: true,
          schedule: {
            select: {
              partner: {
                select: {
                  id: true,
                  name: true,
                  referralsReceived: {
                    select: {
                      id: true,
                      inviter: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      // 檢查哪些訂單已經計算過推薦收入
      const bookingIds = completedBookings.map((b) => b.id)
      const calculatedEarnings = await client.referralEarning.findMany({
        where: {
          bookingId: {
            in: bookingIds,
          },
        },
        select: {
          bookingId: true,
          amount: true,
        },
      })

      const calculatedBookingIds = new Set(calculatedEarnings.map((e) => e.bookingId))
      const totalCalculatedAmount = calculatedEarnings.reduce((sum, e) => sum + (e.amount || 0), 0)

      // 統計
      const stats = {
        totalCompleted: completedBookings.length,
        withReferral: completedBookings.filter(
          (b) => b.schedule?.partner?.referralsReceived
        ).length,
        calculated: calculatedBookingIds.size,
        notCalculated: completedBookings.filter(
          (b) => !calculatedBookingIds.has(b.id) && b.schedule?.partner?.referralsReceived
        ).length,
        totalCalculatedAmount,
        averageAmount: calculatedEarnings.length > 0
          ? totalCalculatedAmount / calculatedEarnings.length
          : 0,
      }

      // 找出需要計算的訂單
      const needsCalculation = completedBookings
        .filter(
          (b) =>
            !calculatedBookingIds.has(b.id) &&
            b.schedule?.partner?.referralsReceived &&
            b.finalAmount &&
            b.finalAmount > 0
        )
        .map((b) => ({
          bookingId: b.id,
          partnerName: b.schedule?.partner?.name || '未知',
          inviterName: b.schedule?.partner?.referralsReceived?.inviter?.name || '未知',
          amount: b.finalAmount || 0,
          createdAt: b.createdAt,
        }))

      return {
        stats,
        needsCalculation: needsCalculation.slice(0, 100), // 只返回前 100 個
        totalNeedsCalculation: needsCalculation.length,
      }
    }, 'admin:referral:recalculate-earnings:stats')

    return NextResponse.json(result)
  } catch (error) {
    console.error('獲取推薦收入統計錯誤:', error)
    return createErrorResponse(error, 'admin:referral:recalculate-earnings:stats')
  }
}
