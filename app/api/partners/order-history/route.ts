import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      include: { user: true }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    // 獲取查詢參數
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') // 可選的狀態篩選
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 計算偏移量
    const skip = (page - 1) * limit

    // 建立查詢條件
    const where: any = {
      schedule: {
        partnerId: partner.id
      }
    }

    // 添加狀態篩選
    if (status && status !== 'ALL') {
      where.status = status
    }

    // 添加日期範圍篩選
    if (startDate || endDate) {
      where.schedule = {
        ...where.schedule,
        startTime: {}
      }
      if (startDate) {
        where.schedule.startTime.gte = new Date(startDate)
      }
      if (endDate) {
        where.schedule.startTime.lte = new Date(endDate)
      }
    }

    // 查詢接單紀錄
    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: {
            include: {
              user: true
            }
          },
          schedule: {
            include: {
              partner: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.booking.count({ where })
    ])

    // 計算分頁資訊
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    // 格式化資料
    const formattedBookings = bookings.map(booking => {
      const startTime = new Date(booking.schedule.startTime)
      const endTime = new Date(booking.schedule.endTime)
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 30)) // 以30分鐘為單位

      return {
        id: booking.id,
        orderNumber: booking.orderNumber,
        customerName: booking.customer.user.name,
        customerId: booking.customer.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        status: booking.status,
        originalAmount: booking.originalAmount,
        finalAmount: booking.finalAmount,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        paymentInfo: booking.paymentInfo,
        isInstantBooking: (booking.paymentInfo as any)?.type === 'instant'
      }
    })

    // 計算統計資料
    const stats = await prisma.booking.aggregate({
      where: {
        schedule: {
          partnerId: partner.id
        },
        status: {
          in: ['COMPLETED', 'CONFIRMED']
        }
      },
      _sum: {
        finalAmount: true
      },
      _count: {
        id: true
      }
    })

    return NextResponse.json({
      bookings: formattedBookings,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      },
      stats: {
        totalEarnings: stats._sum.finalAmount || 0,
        totalOrders: stats._count.id || 0
      }
    })

  } catch (error) {
    console.error('獲取接單紀錄時發生錯誤:', error)
    return NextResponse.json({ error: '獲取接單紀錄失敗' }, { status: 500 })
  }
}

// 刪除舊資料的 API（可選功能）
export async function DELETE(request: NextRequest) {
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
    const months = parseInt(searchParams.get('months') || '1') // 預設刪除1個月前的資料

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)

    // 刪除舊的預約記錄（只刪除已完成的記錄）
    const deletedBookings = await prisma.booking.deleteMany({
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

    return NextResponse.json({
      message: `已刪除 ${deletedBookings.count} 筆 ${months} 個月前的接單紀錄`,
      deletedCount: deletedBookings.count,
      cutoffDate: cutoffDate.toISOString()
    })

  } catch (error) {
    console.error('刪除舊資料時發生錯誤:', error)
    return NextResponse.json({ error: '刪除舊資料失敗' }, { status: 500 })
  }
}
