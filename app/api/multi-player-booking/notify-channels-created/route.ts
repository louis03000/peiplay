import { NextResponse } from 'next/server'
import { sendMultiPlayerChannelsCreatedEmail } from '@/lib/email'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

/**
 * 通知多人陪玩頻道已創建（由 Discord bot 調用）
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { multiPlayerBookingId } = body

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
          bookings: {
            where: {
              status: {
                in: ['CONFIRMED', 'PARTNER_ACCEPTED'],
              },
            },
            include: {
              schedule: {
                include: {
                  partner: {
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
              },
            },
          },
        },
      })

      return multiPlayerBooking
    }, 'multi-player-booking:notify-channels-created')

    if (!result) {
      return NextResponse.json({ error: '找不到多人陪玩訂單' }, { status: 404 })
    }

    const partnerNames = result.bookings.map(
      (b) => b.schedule.partner.user.name || '夥伴'
    )

    // 發送 email 給顧客
    if (result.customer.user.email) {
      await sendMultiPlayerChannelsCreatedEmail(
        result.customer.user.email,
        result.customer.user.name || '顧客',
        true,
        {
          startTime: result.startTime.toISOString(),
          endTime: result.endTime.toISOString(),
          partnerNames,
          customerName: result.customer.user.name || '顧客',
          multiPlayerBookingId: result.id,
        }
      ).catch((error) => {
        console.error('❌ 發送頻道創建通知給顧客失敗:', error)
      })
    }

    // 發送 email 給所有已確認的夥伴
    for (const booking of result.bookings) {
      if (booking.schedule.partner.user.email) {
        await sendMultiPlayerChannelsCreatedEmail(
          booking.schedule.partner.user.email,
          booking.schedule.partner.user.name || '夥伴',
          false,
          {
            startTime: result.startTime.toISOString(),
            endTime: result.endTime.toISOString(),
            partnerNames,
            customerName: result.customer.user.name || '顧客',
            multiPlayerBookingId: result.id,
          }
        ).catch((error) => {
          console.error(
            `❌ 發送頻道創建通知給夥伴 ${booking.schedule.partner.user.name} 失敗:`,
            error
          )
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ 處理頻道創建通知失敗:', error)
    return NextResponse.json(
      { error: '處理失敗' },
      { status: 500 }
    )
  }
}

