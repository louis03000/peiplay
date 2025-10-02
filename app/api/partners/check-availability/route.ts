import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const { partnerId, startTime, endTime } = await request.json()

    if (!partnerId || !startTime || !endTime) {
      return NextResponse.json({ 
        error: '缺少必要參數：partnerId, startTime, endTime' 
      }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    // 檢查夥伴是否存在
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { user: true }
    })

    if (!partner) {
      return NextResponse.json({ 
        error: '找不到指定的夥伴' 
      }, { status: 404 })
    }

    // 檢查夥伴是否被停權
    if (partner.user?.isSuspended) {
      const now = new Date()
      const endsAt = partner.user.suspensionEndsAt ? new Date(partner.user.suspensionEndsAt) : null
      
      if (endsAt && endsAt > now) {
        return NextResponse.json({ 
          error: '該夥伴目前被停權中',
          available: false 
        }, { status: 403 })
      }
    }

    // 檢查時間衝突
    const conflictingBookings = await prisma.booking.findMany({
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
        `${b.schedule.startTime.toLocaleString('zh-TW')} - ${b.schedule.endTime.toLocaleString('zh-TW')}`
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
    const isAvailableNow = partner.isAvailableNow && 
      partner.availableNowSince && 
      new Date(partner.availableNowSince) <= new Date()

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

  } catch (error) {
    console.error('檢查夥伴可用性時發生錯誤:', error)
    return NextResponse.json({ 
      error: '檢查夥伴可用性失敗' 
    }, { status: 500 })
  }
}
