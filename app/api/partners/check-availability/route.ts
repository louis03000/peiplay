import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { parseTaipeiDateTime, getNowTaipei, formatTaipeiLocale } from '@/lib/time-utils'


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const { partnerId, startTime, endTime } = await request.json()

    if (!partnerId || !startTime || !endTime) {
      return NextResponse.json({ 
        error: '缺少必要參數：partnerId, startTime, endTime' 
      }, { status: 400 })
    }

    // 解析時間（假設為台灣時間）
    const start = parseTaipeiDateTime(startTime)
    const end = parseTaipeiDateTime(endTime)

    return await db.query(async (client) => {
      // 檢查夥伴是否存在
      const partner = await client.partner.findUnique({
        where: { id: partnerId },
        include: { user: true }
      })

      if (!partner) {
        throw new Error('找不到指定的夥伴')
      }

      // 檢查夥伴是否被停權
      if (partner.user?.isSuspended) {
        const now = getNowTaipei()
        const endsAt = partner.user.suspensionEndsAt ? parseTaipeiDateTime(partner.user.suspensionEndsAt) : null
        
        if (endsAt && endsAt > now) {
          return NextResponse.json({ 
            error: '該夥伴目前被停權中',
            available: false 
          }, { status: 403 })
        }
      }

      // 檢查時間衝突
      const conflictingBookings = await client.booking.findMany({
      where: {
        schedule: {
          partnerId: partnerId
        },
        status: {
          in: ['PENDING', 'CONFIRMED', 'PARTNER_ACCEPTED', 'PAID_WAITING_PARTNER_CONFIRMATION']
        },
        OR: [
          // 新預約開始時間在現有預約期間內
          {
            schedule: {
              startTime: { lte: start },
              endTime: { gt: start }
            }
          },
          // 新預約結束時間在現有預約期間內
          {
            schedule: {
              startTime: { lt: end },
              endTime: { gte: end }
            }
          },
          // 新預約完全包含現有預約
          {
            schedule: {
              startTime: { gte: start },
              endTime: { lte: end }
            }
          }
        ]
      },
      include: {
        schedule: true,
        customer: {
          include: {
            user: true
          }
        }
      }
    })

    if (conflictingBookings.length > 0) {
      const conflictTimes = conflictingBookings.map(b => 
        `${formatTaipeiLocale(b.schedule.startTime)} - ${formatTaipeiLocale(b.schedule.endTime)}`
      ).join(', ')
      
      return NextResponse.json({ 
        error: `時間衝突！該夥伴在以下時段已有預約：${conflictTimes}`,
        available: false,
        conflicts: conflictingBookings.map(b => ({
          id: b.id,
          startTime: b.schedule.startTime,
          endTime: b.schedule.endTime,
          customerName: b.customer.user.name,
          status: b.status
        }))
      }, { status: 409 })
    }

      // 檢查夥伴是否「現在有空」
      const now = getNowTaipei()
      const isAvailableNow = partner.isAvailableNow && 
        partner.availableNowSince && 
        parseTaipeiDateTime(partner.availableNowSince) <= now

      return NextResponse.json({
        available: true,
        partner: {
          id: partner.id,
          name: partner.name,
          isAvailableNow: isAvailableNow,
          halfHourlyRate: partner.halfHourlyRate
        },
        message: '夥伴可用'
      })
    }, 'partners/check-availability')

  } catch (error) {
    console.error('檢查夥伴可用性時發生錯誤:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '檢查夥伴可用性失敗'
    const status = errorMessage.includes('找不到') ? 404 : 500
    return NextResponse.json({ 
      error: errorMessage 
    }, { status })
  }
}
