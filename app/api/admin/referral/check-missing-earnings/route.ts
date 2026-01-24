import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * 檢查推薦收入計算情況
 * 用於診斷哪些訂單還沒有計算推薦收入
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const inviteePartnerId = searchParams.get('inviteePartnerId') // 被推薦夥伴的 ID
    const inviterPartnerId = searchParams.get('inviterPartnerId') // 推薦人的 ID

    const result = await db.query(async (client) => {
      // 構建查詢條件
      const where: any = {
        finalAmount: { gt: 0 },
      }

      // 如果指定了被推薦夥伴 ID
      if (inviteePartnerId) {
        where.schedule = {
          partnerId: inviteePartnerId,
        }
      }

      // 查找所有已完成的訂單
      const completedBookings = await client.booking.findMany({
        where: {
          ...where,
          status: BookingStatus.COMPLETED,
        },
        include: {
          schedule: {
            include: {
              partner: {
                include: {
                  referralsReceived: {
                    include: {
                      inviter: {
                        select: {
                          id: true,
                          name: true,
                          referralCount: true,
                        },
                      },
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

      // 檢查哪些訂單已經計算過推薦收入
      const bookingIds = completedBookings.map((b) => b.id)
      const calculatedEarnings = await client.referralEarning.findMany({
        where: {
          bookingId: { in: bookingIds },
        },
        select: {
          bookingId: true,
          amount: true,
        },
      })

      const calculatedBookingIds = new Set(calculatedEarnings.map((e) => e.bookingId))

      // 分析結果
      const analysis = {
        totalBookings: completedBookings.length,
        totalAmount: 0,
        bookingsWithReferral: [] as any[],
        bookingsWithoutReferral: [] as any[],
        bookingsNotCalculated: [] as any[],
        bookingsCalculated: [] as any[],
        totalReferralEarnings: 0,
        expectedReferralEarnings: 0,
        missingReferralEarnings: 0,
      }

      for (const booking of completedBookings) {
        const amount = booking.finalAmount || 0
        analysis.totalAmount += amount

        const referralRecord = booking.schedule.partner.referralsReceived

        if (referralRecord) {
          // 有推薦關係
          const inviter = referralRecord.inviter
          
          // 如果指定了推薦人 ID，只處理該推薦人的訂單
          if (inviterPartnerId && inviter.id !== inviterPartnerId) {
            continue
          }

          // 計算推薦比例
          let referralRate = 0
          if (inviter.referralCount >= 1 && inviter.referralCount <= 3) {
            referralRate = 0.02 // 2%
          } else if (inviter.referralCount >= 4 && inviter.referralCount <= 10) {
            referralRate = 0.03 // 3%
          } else if (inviter.referralCount > 10) {
            referralRate = 0.04 // 4%
          }

          const expectedEarning = amount * referralRate
          analysis.expectedReferralEarnings += expectedEarning

          const isCalculated = calculatedBookingIds.has(booking.id)
          const actualEarning = calculatedEarnings.find((e) => e.bookingId === booking.id)?.amount || 0

          const bookingInfo = {
            bookingId: booking.id,
            amount,
            inviterId: inviter.id,
            inviterName: inviter.name,
            inviteeId: booking.schedule.partner.id,
            inviteeName: booking.schedule.partner.name,
            referralRate: referralRate * 100,
            expectedEarning,
            isCalculated,
            actualEarning,
            missing: expectedEarning - actualEarning,
            createdAt: booking.createdAt,
          }

          if (isCalculated) {
            analysis.bookingsCalculated.push(bookingInfo)
            analysis.totalReferralEarnings += actualEarning
          } else {
            analysis.bookingsNotCalculated.push(bookingInfo)
            analysis.missingReferralEarnings += expectedEarning
          }

          analysis.bookingsWithReferral.push(bookingInfo)
        } else {
          // 沒有推薦關係
          analysis.bookingsWithoutReferral.push({
            bookingId: booking.id,
            amount,
            partnerId: booking.schedule.partner.id,
            partnerName: booking.schedule.partner.name,
            createdAt: booking.createdAt,
          })
        }
      }

      return analysis
    }, 'admin:referral:check-missing-earnings')

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ 檢查推薦收入失敗:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
