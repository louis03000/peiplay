import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 查找所有時間衝突的預約
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PARTNER_ACCEPTED']
        }
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
      },
      orderBy: {
        schedule: {
          startTime: 'asc'
        }
      }
    })

    // 按夥伴分組並檢查衝突
    const partnerBookings = new Map()
    const conflicts = []

    for (const booking of conflictingBookings) {
      const partnerId = booking.schedule.partnerId
      if (!partnerBookings.has(partnerId)) {
        partnerBookings.set(partnerId, [])
      }
      partnerBookings.get(partnerId).push(booking)
    }

    // 檢查每個夥伴的預約是否有時間衝突
    for (const [partnerId, bookings] of partnerBookings) {
      for (let i = 0; i < bookings.length; i++) {
        for (let j = i + 1; j < bookings.length; j++) {
          const booking1 = bookings[i]
          const booking2 = bookings[j]
          
          const start1 = new Date(booking1.schedule.startTime)
          const end1 = new Date(booking1.schedule.endTime)
          const start2 = new Date(booking2.schedule.startTime)
          const end2 = new Date(booking2.schedule.endTime)

          // 檢查是否有時間重疊
          if (start1 < end2 && start2 < end1) {
            conflicts.push({
              partnerId,
              partnerName: booking1.schedule.partner.user.name,
              booking1: {
                id: booking1.id,
                customerName: booking1.customer.user.name,
                startTime: start1,
                endTime: end1,
                status: booking1.status
              },
              booking2: {
                id: booking2.id,
                customerName: booking2.customer.user.name,
                startTime: start2,
                endTime: end2,
                status: booking2.status
              }
            })
          }
        }
      }
    }

    return NextResponse.json({
      totalBookings: conflictingBookings.length,
      conflicts: conflicts,
      message: conflicts.length > 0 ? '發現時間衝突' : '沒有發現時間衝突'
    })

  } catch (error) {
    console.error('檢查時間衝突時發生錯誤:', error)
    return NextResponse.json({ error: '檢查失敗' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, bookingIds } = await request.json()

    if (action === 'cancel_later') {
      // 取消較晚創建的預約
      const bookings = await prisma.booking.findMany({
        where: {
          id: { in: bookingIds }
        },
        include: {
          schedule: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // 取消除了最早創建的所有預約
      const toCancel = bookings.slice(1) // 保留第一個（最早創建的），取消其他的
      
      for (const booking of toCancel) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' }
        })
        
        // 重新開放時段
        await prisma.schedule.update({
          where: { id: booking.scheduleId },
          data: { isAvailable: true }
        })
      }

      return NextResponse.json({
        message: `已取消 ${toCancel.length} 個衝突的預約`,
        cancelledBookings: toCancel.map(b => ({
          id: b.id,
          customerName: b.customer?.user?.name,
          startTime: b.schedule.startTime,
          endTime: b.schedule.endTime
        }))
      })
    }

    return NextResponse.json({ error: '無效的操作' }, { status: 400 })

  } catch (error) {
    console.error('修復時間衝突時發生錯誤:', error)
    return NextResponse.json({ error: '修復失敗' }, { status: 500 })
  }
}
