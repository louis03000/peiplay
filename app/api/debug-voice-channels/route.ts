import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


export const dynamic = 'force-dynamic';
const prisma = new PrismaClient()

export async function GET() {
  try {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000) // 15分鐘前
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000)   // 5分鐘後

    console.log('🔍 調試語音頻道創建條件')
    console.log('當前時間:', now.toISOString())
    console.log('查詢窗口:', windowStart.toISOString(), '到', windowEnd.toISOString())

    // 查詢符合條件的預約
    const bookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ['CONFIRMED', 'COMPLETED', 'PARTNER_ACCEPTED']
        },
        schedule: {
          startTime: {
            gte: windowStart,
            lte: windowEnd
          }
        },
        discordVoiceChannelId: null
      },
      include: {
        schedule: {
          include: {
            partner: {
              include: {
                user: true
              }
            }
          }
        },
        customer: {
          include: {
            user: true
          }
        }
      }
    })

    console.log('找到預約數量:', bookings.length)

    const result = bookings.map(booking => ({
      id: booking.id,
      status: booking.status,
      startTime: booking.schedule.startTime,
      endTime: booking.schedule.endTime,
      customerDiscord: booking.customer.user.discord,
      partnerDiscord: booking.schedule.partner.user.discord,
      hasTextChannel: !!booking.discordTextChannelId,
      hasVoiceChannel: !!booking.discordVoiceChannelId,
      textChannelId: booking.discordTextChannelId,
      voiceChannelId: booking.discordVoiceChannelId
    }))

    return NextResponse.json({
      currentTime: now.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      bookingsFound: bookings.length,
      bookings: result
    })

  } catch (error) {
    console.error('調試語音頻道創建失敗:', error)
    return NextResponse.json({ error: '調試失敗' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
