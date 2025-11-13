import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { months = 1 } = await request.json()

    if (months < 1 || months > 12) {
      return NextResponse.json({ error: '月份範圍必須在 1-12 之間' }, { status: 400 })
    }

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)

    return await db.query(async (client) => {
      // 檢查是否為夥伴
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id }
      })

      if (!partner) {
        throw new Error('您不是夥伴')
      }

      // 使用事務確保資料一致性
      return await client.$transaction(async (tx) => {
      // 1. 查找要刪除的預約記錄
      const bookingsToDelete = await tx.booking.findMany({
        where: {
          schedule: {
            partnerId: partner.id
          },
          status: 'COMPLETED',
          createdAt: {
            lt: cutoffDate
          }
        },
        include: {
          schedule: true
        }
      })

      // 2. 刪除相關的 schedule 記錄
      const scheduleIds = bookingsToDelete.map(b => b.scheduleId)
      await tx.schedule.deleteMany({
        where: {
          id: { in: scheduleIds }
        }
      })

      // 3. 刪除預約記錄
      const deletedBookings = await tx.booking.deleteMany({
        where: {
          schedule: {
            partnerId: partner.id
          },
          status: 'COMPLETED',
          createdAt: {
            lt: cutoffDate
          }
        }
      })

        return {
          deletedBookings: deletedBookings.count,
          deletedSchedules: scheduleIds.length,
          cutoffDate
        }
      })
    }, 'partners/cleanup-old-data').then(result => {
      return NextResponse.json({
        message: `已清理 ${months} 個月前的資料`,
        deletedBookings: result.deletedBookings,
        deletedSchedules: result.deletedSchedules,
        cutoffDate: result.cutoffDate.toISOString(),
        warning: '此操作無法復原，請謹慎使用'
      })
    })

  } catch (error) {
    console.error('清理舊資料時發生錯誤:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '清理舊資料失敗'
    const status = errorMessage.includes('不是夥伴') ? 403 : 500
    return NextResponse.json({ error: errorMessage }, { status })
  }
}

// 獲取清理建議
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '1')

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)

    const result = await db.query(async (client) => {
      // 檢查是否為夥伴
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id }
      })

      if (!partner) {
        throw new Error('您不是夥伴')
      }

      // 統計要清理的資料
      const [oldBookings, totalBookings, totalSchedules] = await Promise.all([
        client.booking.count({
          where: {
            schedule: {
              partnerId: partner.id
            },
            status: 'COMPLETED',
            createdAt: {
              lt: cutoffDate
            }
          }
        }),
        client.booking.count({
          where: {
            schedule: {
              partnerId: partner.id
            }
          }
        }),
        client.schedule.count({
          where: {
            partnerId: partner.id
          }
        })
      ])

      return {
        cleanupSuggestion: {
          months,
          cutoffDate: cutoffDate.toISOString(),
          oldBookingsToDelete: oldBookings,
          totalBookings,
          totalSchedules,
          willDeletePercentage: totalBookings > 0 ? Math.round((oldBookings / totalBookings) * 100) : 0
        },
        recommendation: oldBookings > 100 ? 
          '建議清理舊資料以提升性能' : 
          '資料量較少，暫不需要清理'
      }
    }, 'partners/cleanup-old-data:GET')

    return NextResponse.json(result)

  } catch (error) {
    console.error('獲取清理建議時發生錯誤:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '獲取清理建議失敗'
    const status = errorMessage.includes('不是夥伴') ? 403 : 500
    return NextResponse.json({ error: errorMessage }, { status })
  }
}
