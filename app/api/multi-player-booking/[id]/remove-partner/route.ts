import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 移除已同意夥伴（含違規記錄和退費處理）
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const multiPlayerBookingId = resolvedParams.id
    const { bookingId, reason } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: '請提供預約ID' }, { status: 400 })
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: '請提供移除理由' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          violationCount: true,
          violations: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })

      if (!customer) {
        return { type: 'NO_CUSTOMER' } as const
      }

      // 查找多人陪玩群組
      const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
        where: { id: multiPlayerBookingId },
        include: {
          bookings: {
            include: {
              schedule: {
                include: {
                  partner: {
                    include: {
                      user: {
                        select: {
                          name: true,
                          email: true,
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

      if (!multiPlayerBooking) {
        return { type: 'NOT_FOUND' } as const
      }

      if (multiPlayerBooking.customerId !== customer.id) {
        return { type: 'FORBIDDEN' } as const
      }

      // 檢查調整期限（時段開始前30分鐘）
      const now = new Date()
      const thirtyMinutesBeforeStart = new Date(multiPlayerBooking.startTime.getTime() - 30 * 60 * 1000)
      
      if (now >= thirtyMinutesBeforeStart) {
        return { type: 'ADJUSTMENT_CLOSED' } as const
      }

      // 查找要移除的 booking
      const bookingToRemove = multiPlayerBooking.bookings.find(b => b.id === bookingId)

      if (!bookingToRemove) {
        return { type: 'BOOKING_NOT_FOUND' } as const
      }

      // 檢查 booking 狀態
      if (bookingToRemove.status === 'CANCELLED' || bookingToRemove.status === 'REJECTED') {
        return { type: 'ALREADY_REMOVED' } as const
      }

      // 檢查是否為已同意的夥伴
      const isConfirmed = bookingToRemove.status === 'CONFIRMED' || bookingToRemove.status === 'PARTNER_ACCEPTED'

      return await client.$transaction(async (tx) => {
        // 計算退費金額
        const refundAmount = bookingToRemove.originalAmount * 0.7 // 用戶退70%
        const partnerAmount = bookingToRemove.originalAmount * 0.15 // 夥伴15%
        const platformAmount = bookingToRemove.originalAmount * 0.15 // 平台15%

        // 更新 booking 狀態為 CANCELLED
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.CANCELLED,
            rejectReason: reason.trim(),
            paymentInfo: {
              ...(bookingToRemove.paymentInfo as any || {}),
              refunds: [
                ...((bookingToRemove.paymentInfo as any)?.refunds || []),
                {
                  bookingId: bookingId,
                  amount: bookingToRemove.originalAmount,
                  refundAmount,
                  partnerAmount,
                  platformAmount,
                  reason: reason.trim(),
                  refundedAt: new Date().toISOString(),
                  isConfirmedPartnerRemoval: isConfirmed,
                },
              ],
            },
          },
        })

        // 更新群組總金額
        await tx.multiPlayerBooking.update({
          where: { id: multiPlayerBookingId },
          data: {
            totalAmount: multiPlayerBooking.totalAmount - bookingToRemove.originalAmount,
            lastAdjustmentAt: new Date(),
          },
        })

        // 如果是移除已同意的夥伴，記錄違規
        let newViolationCount = customer.violationCount
        let violations = (customer.violations as any) || []

        if (isConfirmed) {
          newViolationCount += 1
          violations.push({
            time: new Date().toISOString(),
            reason: reason.trim(),
            bookingId: bookingId,
            partnerName: bookingToRemove.schedule.partner.user.name,
            multiPlayerBookingId: multiPlayerBookingId,
          })

          // 更新客戶違規記錄
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              violationCount: newViolationCount,
              violations: violations,
            },
          })

          // 如果違規次數達到3次，停權用戶
          if (newViolationCount >= 3) {
            await tx.user.update({
              where: { id: session.user.id },
              data: {
                isSuspended: true,
                suspensionEndsAt: null, // 永久停權
                suspensionReason: '移除已同意夥伴違規次數達3次',
              },
            })
          }
        }

        return {
          type: 'SUCCESS' as const,
          booking: updatedBooking,
          refundAmount,
          partnerAmount,
          platformAmount,
          isViolation: isConfirmed,
          violationCount: newViolationCount,
          isSuspended: newViolationCount >= 3,
        }
      })
    }, 'multi-player-booking:remove-partner')

    if (result.type === 'NO_CUSTOMER') {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 })
    }

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '多人陪玩群組不存在' }, { status: 404 })
    }

    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '無權限操作此群組' }, { status: 403 })
    }

    if (result.type === 'ADJUSTMENT_CLOSED') {
      return NextResponse.json({ error: '時段開始前30分鐘無法再調整' }, { status: 400 })
    }

    if (result.type === 'BOOKING_NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 })
    }

    if (result.type === 'ALREADY_REMOVED') {
      return NextResponse.json({ error: '該夥伴已被移除' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      refundAmount: result.refundAmount,
      partnerAmount: result.partnerAmount,
      platformAmount: result.platformAmount,
      isViolation: result.isViolation,
      violationCount: result.violationCount,
      isSuspended: result.isSuspended,
      message: result.isViolation 
        ? `已移除夥伴。您已違規 ${result.violationCount} 次，${result.isSuspended ? '帳號已被停權' : `再違規 ${3 - result.violationCount} 次將被停權`}`
        : '已移除夥伴',
    })
  } catch (error) {
    console.error('移除夥伴失敗:', error)
    return createErrorResponse(error, 'multi-player-booking:remove-partner')
  }
}

