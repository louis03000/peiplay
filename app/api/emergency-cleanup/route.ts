import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    console.log('🚨 開始緊急清理重複預約...')

    // 查找所有重複的預約（相同夥伴、相同時間）
    const allBookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ['PENDING', 'CONFIRMED', 'PARTNER_ACCEPTED']
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
        createdAt: 'asc' // 保留最早創建的
      }
    })

    // 按夥伴和時間分組
    const bookingGroups = new Map()
    
    for (const booking of allBookings) {
      const key = `${booking.schedule.partnerId}-${booking.schedule.startTime.toISOString()}-${booking.schedule.endTime.toISOString()}`
      
      if (!bookingGroups.has(key)) {
        bookingGroups.set(key, [])
      }
      bookingGroups.get(key).push(booking)
    }

    const duplicates = []
    const toCancel = []

    // 找出重複的預約
    for (const [key, bookings] of bookingGroups) {
      if (bookings.length > 1) {
        duplicates.push({
          key,
          partnerName: bookings[0].schedule.partner.user.name,
          startTime: bookings[0].schedule.startTime,
          endTime: bookings[0].schedule.endTime,
          totalCount: bookings.length,
          bookings: bookings.map((b: any) => ({
            id: b.id,
            customerName: b.customer.user.name,
            status: b.status,
            createdAt: b.createdAt
          }))
        })

        // 保留第一個（最早創建的），取消其他的
        toCancel.push(...bookings.slice(1))
      }
    }

    console.log(`發現 ${duplicates.length} 組重複預約，共 ${toCancel.length} 個需要取消`)

    // 取消重複的預約
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

      console.log(`✅ 已取消預約 ${booking.id} (客戶: ${booking.customer.user.name})`)
    }

    return NextResponse.json({
      message: `緊急清理完成！`,
      duplicatesFound: duplicates.length,
      bookingsCancelled: toCancel.length,
      duplicates: duplicates,
      cancelledBookings: toCancel.map(b => ({
        id: b.id,
        customerName: b.customer.user.name,
        startTime: b.schedule.startTime,
        endTime: b.schedule.endTime
      }))
    })

  } catch (error) {
    console.error('緊急清理時發生錯誤:', error)
    return NextResponse.json({ error: '清理失敗' }, { status: 500 })
  }
}
