import { NextResponse } from 'next/server'
import { sendMultiPlayerAutoCancelledEmail } from '@/lib/email'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

/**
 * 通知多人陪玩訂單已自動取消（由 Discord bot 調用）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { multiPlayerBookingId, reason } = body

    if (!multiPlayerBookingId) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 查找多人陪玩訂單信息
    const result = await db.query(async (client) => {
      const multiPlayerBooking = await client.multiPlayerBooking.findUnique({
        where: { id: multiPlayerBookingId },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      return multiPlayerBooking
    }, 'multi-player-booking:notify-auto-cancelled')

    if (!result) {
      return NextResponse.json({ error: '找不到多人陪玩訂單' }, { status: 404 })
    }

    // 發送 email 給顧客
    if (result.customer.user.email) {
      await sendMultiPlayerAutoCancelledEmail(
        result.customer.user.email,
        result.customer.user.name || '顧客',
        {
          startTime: result.startTime.toISOString(),
          endTime: result.endTime.toISOString(),
          multiPlayerBookingId: result.id,
          reason: reason || '所有夥伴都拒絕或沒有回應，系統自動取消訂單',
        }
      ).catch((error) => {
        console.error('❌ 發送自動取消通知給顧客失敗:', error)
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ 處理自動取消通知失敗:', error)
    return NextResponse.json(
      { error: '處理失敗' },
      { status: 500 }
    )
  }
}

