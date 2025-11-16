import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { BookingStatus } from '@prisma/client'
import { sendBookingConfirmationEmail } from '@/lib/email'
import { createChatRoomForBooking } from '@/lib/chat-helpers'

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, orderNumber, paymentInfo, paymentError } = body

    if (!status) {
      return NextResponse.json(
        { error: '缺少狀態參數' },
        { status: 400 }
      )
    }

    const bookingId = params.id
    if (!bookingId) {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 })
    }

    const result = await db.query(async (client) => {
      const currentBooking = await client.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, isGroupBooking: true },
      })

      if (!currentBooking) {
        return { type: 'NOT_FOUND' } as const
      }

      let finalStatus: BookingStatus = status as BookingStatus

      if (orderNumber && (currentBooking.status === BookingStatus.PENDING_PAYMENT || currentBooking.status === BookingStatus.PENDING)) {
        finalStatus = currentBooking.isGroupBooking
          ? BookingStatus.CONFIRMED
          : BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION
      } else if (status === BookingStatus.CONFIRMED && currentBooking.status === BookingStatus.PENDING_PAYMENT) {
        if (!currentBooking.isGroupBooking) {
          return { type: 'INVALID_TRANSITION' } as const
        }
      }

      const updatedBooking = await client.booking.update({
        where: { id: bookingId },
        data: {
          status: finalStatus,
          ...(orderNumber && { orderNumber }),
          ...(paymentInfo && { paymentInfo }),
          ...(paymentError && { paymentError }),
        },
        include: {
          customer: { include: { user: true } },
          schedule: { include: { partner: { include: { user: true } } } },
        },
      })

      return { type: 'SUCCESS', finalStatus, booking: updatedBooking } as const
    }, 'bookings:update-status')

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 })
    }
    if (result.type === 'INVALID_TRANSITION') {
      return NextResponse.json(
        { error: '非群組預約需要先等待夥伴確認，不能直接設置為已確認' },
        { status: 400 }
      )
    }

    const { booking, finalStatus } = result

    // 如果狀態變為 CONFIRMED 或 PARTNER_ACCEPTED，自動創建聊天室（非阻塞）
    if (
      (finalStatus === BookingStatus.CONFIRMED ||
        finalStatus === BookingStatus.PARTNER_ACCEPTED) &&
      bookingId
    ) {
      db.query(
        async (client) => {
          await createChatRoomForBooking(client, bookingId);
        },
        'chat:auto-create-on-status-update'
      ).catch((error) => {
        console.error('❌ 自動創建聊天室失敗:', error);
      });
    }

    if (finalStatus === BookingStatus.CONFIRMED && booking.customer.user.email) {
      try {
        const duration = Math.round((new Date(booking.schedule.endTime).getTime() - new Date(booking.schedule.startTime).getTime()) / (1000 * 60))

        await sendBookingConfirmationEmail(
          booking.customer.user.email,
          booking.customer.user.name || '客戶',
          booking.schedule.partner.user.name || '夥伴',
          {
            duration,
            startTime: booking.schedule.startTime.toISOString(),
            endTime: booking.schedule.endTime.toISOString(),
            totalCost: booking.finalAmount || 0,
            bookingId: booking.id,
          }
        )
      } catch (emailError) {
        console.error('❌ 發送預約確認通知失敗:', emailError)
      }
    }

    if (finalStatus === BookingStatus.COMPLETED) {
      try {
        const referralResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/partners/referral/calculate-earnings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookingId }),
        })

        if (!referralResponse.ok) {
          console.warn(`⚠️ 預約 ${bookingId} 推薦收入計算失敗:`, referralResponse.status)
        }
      } catch (error) {
        console.error(`❌ 預約 ${bookingId} 推薦收入計算錯誤:`, error)
      }
    }

    return NextResponse.json(booking)
  } catch (error) {
    return createErrorResponse(error, 'bookings:update-status')
  }
} 