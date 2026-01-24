import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * 自動計算推薦收入的 Cron Job
 * 
 * 定期檢查所有已完成的訂單，確保推薦收入都被正確計算
 * 這樣即使夥伴沒有打開推薦系統頁面，推薦收入也會自動更新
 * 
 * 建議執行頻率：每小時執行一次
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證 Cron Secret（防止未授權調用）
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const now = new Date()
      
      // 1. 查找所有已結束的訂單（包括 CONFIRMED, COMPLETED, PARTNER_ACCEPTED）
      // 只要 endTime <= now，就應該計算推薦收入
      const completedBookings = await client.booking.findMany({
        where: {
          status: {
            in: [BookingStatus.COMPLETED, BookingStatus.CONFIRMED, BookingStatus.PARTNER_ACCEPTED]
          },
          finalAmount: { gt: 0 }, // 只處理有金額的訂單
          schedule: {
            endTime: {
              lte: now, // 🔥 只處理已結束的訂單
            },
          },
        },
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
      })

      console.log(`🔍 [推薦收入自動計算] 找到 ${completedBookings.length} 個已完成的訂單`)

      let processedCount = 0
      let calculatedCount = 0
      let skippedCount = 0
      let errorCount = 0

      // 2. 檢查每個訂單是否已經計算過推薦收入
      for (const booking of completedBookings) {
        try {
          // 檢查是否已經有推薦收入記錄
          const existingEarning = await client.referralEarning.findFirst({
            where: { bookingId: booking.id },
          })

          if (existingEarning) {
            // 已經計算過，跳過
            skippedCount++
            continue
          }

          // 檢查這個夥伴是否是被推薦的
          const referralRecord = booking.schedule.partner.referralsReceived
          if (!referralRecord) {
            // 不是被推薦的夥伴，不需要計算推薦收入
            skippedCount++
            continue
          }

          // 3. 調用推薦收入計算 API
          const baseUrl = process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'
          try {
            const calculateResponse = await fetch(
              `${baseUrl}/api/partners/referral/calculate-earnings`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: booking.id }),
              }
            )

            if (calculateResponse.ok) {
              const result = await calculateResponse.json()
              if (result.type === 'SUCCESS' || result.type === 'ALREADY_CALCULATED') {
                calculatedCount++
                console.log(
                  `✅ [推薦收入自動計算] 訂單 ${booking.id} 推薦收入計算成功: ${result.payload?.referralEarning || 0}`
                )
              } else {
                console.log(
                  `⚠️ [推薦收入自動計算] 訂單 ${booking.id} 推薦收入計算結果: ${result.type}`
                )
                skippedCount++
              }
            } else {
              const error = await calculateResponse.json()
              console.warn(
                `⚠️ [推薦收入自動計算] 訂單 ${booking.id} 推薦收入計算失敗:`,
                error
              )
              errorCount++
            }
          } catch (fetchError) {
            console.error(
              `❌ [推薦收入自動計算] 訂單 ${booking.id} 推薦收入計算 API 調用失敗:`,
              fetchError
            )
            errorCount++
          }

          processedCount++
        } catch (error) {
          console.error(
            `❌ [推薦收入自動計算] 處理訂單 ${booking.id} 時發生錯誤:`,
            error
          )
          errorCount++
        }
      }

      // 4. 修復數據一致性：確保所有 Partner 的 referralEarnings 與 ReferralEarning 表一致
      console.log(`🔧 [推薦收入自動計算] 開始修復數據一致性...`)
      const allPartners = await client.partner.findMany({
        where: {
          referralCount: { gt: 0 }, // 只處理有推薦記錄的夥伴
        },
        select: {
          id: true,
          name: true,
          referralEarnings: true,
        },
      })

      let fixedCount = 0
      for (const partner of allPartners) {
        try {
          const totalEarnings = await client.referralEarning.aggregate({
            where: { referralRecord: { inviterId: partner.id } },
            _sum: { amount: true },
          })

          const totalFromDB = totalEarnings._sum.amount || 0
          const currentEarnings = partner.referralEarnings || 0

          // 如果數據不一致，修復它
          if (Math.abs(totalFromDB - currentEarnings) > 0.01) {
            if (totalFromDB > currentEarnings) {
              await client.partner.update({
                where: { id: partner.id },
                data: { referralEarnings: totalFromDB },
              })
              fixedCount++
              console.log(
                `🔧 [推薦收入自動計算] 修復夥伴 ${partner.id} (${partner.name}) 的推薦收入: ${currentEarnings} → ${totalFromDB}`
              )
            }
          }
        } catch (error) {
          console.error(
            `❌ [推薦收入自動計算] 修復夥伴 ${partner.id} 數據時發生錯誤:`,
            error
          )
        }
      }

      return {
        success: true,
        stats: {
          totalBookings: completedBookings.length,
          processed: processedCount,
          calculated: calculatedCount,
          skipped: skippedCount,
          errors: errorCount,
          dataFixed: fixedCount,
        },
        message: `處理了 ${processedCount} 個訂單，計算了 ${calculatedCount} 個推薦收入，修復了 ${fixedCount} 個數據不一致`,
      }
    }, 'cron/calculate-referral-earnings')

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [推薦收入自動計算] Cron Job 執行失敗:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
