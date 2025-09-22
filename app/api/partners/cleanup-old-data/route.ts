import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    const { months = 1 } = await request.json()

    if (months < 1 || months > 12) {
      return NextResponse.json({ error: '月份範圍必須在 1-12 之間' }, { status: 400 })
    }

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)

    // 使用事務確保資料一致性
    const result = await prisma.$transaction(async (tx) => {
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

    return NextResponse.json({
      message: `已清理 ${months} 個月前的資料`,
      deletedBookings: result.deletedBookings,
      deletedSchedules: result.deletedSchedules,
      cutoffDate: result.cutoffDate.toISOString(),
      warning: '此操作無法復原，請謹慎使用'
    })

  } catch (error) {
    console.error('清理舊資料時發生錯誤:', error)
    return NextResponse.json({ error: '清理舊資料失敗' }, { status: 500 })
  }
}

// 獲取清理建議
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '1')

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)

    // 統計要清理的資料
    const [oldBookings, totalBookings, totalSchedules] = await Promise.all([
      prisma.booking.count({
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
      prisma.booking.count({
        where: {
          schedule: {
            partnerId: partner.id
          }
        }
      }),
      prisma.schedule.count({
        where: {
          partnerId: partner.id
        }
      })
    ])

    return NextResponse.json({
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
    })

  } catch (error) {
    console.error('獲取清理建議時發生錯誤:', error)
    return NextResponse.json({ error: '獲取清理建議失敗' }, { status: 500 })
  }
}
