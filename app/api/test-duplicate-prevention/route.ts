import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    console.log('🔍 開始檢查防重複預約機制...')

    // 1. 檢查所有「現在有空」的夥伴和所有預約
    const { availableNowPartners, allBookings } = await db.query(async (client) => {
      const partners = await client.partner.findMany({
        where: {
          isAvailableNow: true
        },
        include: {
          user: true,
          schedules: {
            where: {
              isAvailable: true
            },
            include: {
              bookings: {
                where: {
                  status: {
                    notIn: ['CANCELLED', 'REJECTED']
                  }
                }
              }
            }
          }
        }
      });

      // 3. 檢查所有預約的時間衝突
      const bookings = await client.booking.findMany({
        where: {
          status: {
            in: ['PENDING', 'CONFIRMED', 'PARTNER_ACCEPTED', 'PAID_WAITING_PARTNER_CONFIRMATION']
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
      });

      return { availableNowPartners: partners, allBookings: bookings };
    });

    console.log(`找到 ${availableNowPartners.length} 個「現在有空」的夥伴`)

    // 2. 檢查每個夥伴是否有時間衝突
    const conflicts = []
    for (const partner of availableNowPartners) {
      const activeBookings = partner.schedules.filter(schedule => 
        schedule.bookings && 
        schedule.bookings.status !== 'CANCELLED' && 
        schedule.bookings.status !== 'REJECTED'
      )

      if (activeBookings.length > 0) {
        conflicts.push({
          partnerId: partner.id,
          partnerName: partner.name,
          activeBookings: activeBookings.length,
          schedules: partner.schedules.length
        })
      }
    }

    // 按夥伴分組並檢查時間衝突
    const partnerBookings = new Map()
    const timeConflicts = []

    for (const booking of allBookings) {
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
            timeConflicts.push({
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
      summary: {
        totalAvailableNowPartners: availableNowPartners.length,
        partnersWithConflicts: conflicts.length,
        totalActiveBookings: allBookings.length,
        timeConflicts: timeConflicts.length
      },
      availableNowPartners: availableNowPartners.map(p => ({
        id: p.id,
        name: p.name,
        isAvailableNow: p.isAvailableNow,
        availableNowSince: p.availableNowSince,
        activeBookings: p.schedules.flatMap(s => s.bookings).length
      })),
      conflicts,
      timeConflicts,
      message: conflicts.length === 0 && timeConflicts.length === 0 ? 
        '✅ 沒有發現重複預約問題' : 
        '⚠️ 發現潛在的重複預約問題'
    })

  } catch (error) {
    console.error('檢查防重複預約機制時發生錯誤:', error)
    return NextResponse.json({ 
      error: '檢查失敗',
      details: error instanceof Error ? error.message : '未知錯誤'
    }, { status: 500 })
  }
}
