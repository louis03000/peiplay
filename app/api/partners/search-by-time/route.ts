import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const startTime = searchParams.get('startTime') // 格式: "10:00"
    const endTime = searchParams.get('endTime') // 格式: "12:00"
    const game = searchParams.get('game')

    if (!startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 轉換時間格式為 Date 對象
    const startDateTime = new Date(`${startDate}T${startTime}:00`)
    const endDateTime = new Date(`${endDate}T${endTime}:00`)

    // 查詢在指定日期範圍和時段範圍內有可用時段的夥伴
    const partners = await prisma.partner.findMany({
      where: {
        status: 'APPROVED',
        schedules: {
          some: {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
            startTime: {
              lte: startTime, // 時段開始時間不晚於搜尋開始時間
            },
            endTime: {
              gte: endTime, // 時段結束時間不早於搜尋結束時間
            },
            isAvailable: true
          }
        },
        // 遊戲篩選
        ...(game && game.trim() ? {
          games: {
            hasSome: [game.trim()]
          }
        } : {})
      },
      include: {
        user: {
          select: {
            email: true,
            discord: true,
            isSuspended: true,
            suspensionEndsAt: true,
            reviewsReceived: {
              select: {
                rating: true
              }
            }
          }
        },
        schedules: {
          where: {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
            startTime: {
              lte: startTime,
            },
            endTime: {
              gte: endTime,
            },
            isAvailable: true
          },
          include: {
            bookings: {
              select: {
                id: true,
                status: true,
              }
            }
          }
        }
      }
    })

    // 過濾掉被停權的夥伴
    const availablePartners = partners.filter(partner => {
      if (!partner.user) return true
      
      const user = partner.user as any
      if (user.isSuspended) {
        const now = new Date()
        const endsAt = user.suspensionEndsAt ? new Date(user.suspensionEndsAt) : null
        
        if (endsAt && endsAt > now) {
          return false
        }
      }
      
      return true
    })

    // 只返回有可用時段的夥伴，並為每個時段添加搜尋時段限制，同時計算平均星等
    const partnersWithAvailableSchedules = availablePartners
      .map(partner => {
        // 計算平均星等
        const reviews = partner.user?.reviewsReceived || [];
        const averageRating = reviews.length > 0 
          ? reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length
          : 0;
        
        return {
          ...partner,
          averageRating: Math.round(averageRating * 10) / 10, // 保留一位小數
          totalReviews: reviews.length,
          schedules: partner.schedules.filter(schedule => {
            // 過濾掉已被預約的時段（排除已取消和已拒絕的預約）
            if (schedule.bookings && schedule.bookings.status && 
                schedule.bookings.status !== 'CANCELLED' && 
                schedule.bookings.status !== 'REJECTED') {
              return false;
            }
            return true;
          }).map(schedule => ({
            ...schedule,
            // 添加搜尋時段限制信息
            searchTimeRestriction: {
              startTime,
              endTime,
              startDate,
              endDate
            }
          }))
        };
      })
      .filter(partner => partner.schedules.length > 0)

    return NextResponse.json(partnersWithAvailableSchedules)
  } catch (error) {
    console.error('Error searching partners by time:', error)
    return NextResponse.json(
      { error: '搜尋夥伴失敗' },
      { status: 500 }
    )
  }
}
