import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 獲取符合群組預約條件的夥伴
export async function GET(request: Request) {
  try {
    const now = new Date();
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const game = searchParams.get('game');

    if (!startTime || !endTime) {
      return NextResponse.json({ error: '請提供開始時間和結束時間' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // 查詢條件：允許群組預約且狀態為已批准的夥伴
    const where: any = {
      allowGroupBooking: true,
      status: 'APPROVED'
    };

    // 如果指定了遊戲，則篩選該遊戲
    if (game) {
      where.games = {
        has: game
      };
    }

    // 查詢夥伴
    const partners = await prisma.partner.findMany({
      where,
      select: {
        id: true,
        name: true,
        coverImage: true,
        games: true,
        halfHourlyRate: true,
        allowGroupBooking: true,
        user: {
          select: {
            isSuspended: true,
            suspensionEndsAt: true,
            reviewsReceived: {
              where: {
                isApproved: true
              },
              select: {
                rating: true
              }
            }
          }
        },
        schedules: {
          where: {
            date: {
              gte: start,
              lt: end
            },
            startTime: {
              lte: start
            },
            endTime: {
              gte: end
            },
            isAvailable: true
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            bookings: {
              where: {
                status: {
                  notIn: ['CANCELLED', 'REJECTED']
                }
              },
              select: {
                status: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 過濾掉沒有合適時段的夥伴
    const availablePartners = partners.filter(partner => {
      // 檢查是否有合適的時段
      return partner.schedules.some(schedule => {
        // 時段必須完全包含用戶選擇的時間範圍
        const scheduleStart = new Date(`${schedule.date}T${schedule.startTime}`);
        const scheduleEnd = new Date(`${schedule.date}T${schedule.endTime}`);
        
        return scheduleStart <= start && scheduleEnd >= end;
      });
    });

    // 同時獲取該時段的群組預約
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const groupBookings = await prisma.groupBooking.findMany({
      where: {
        status: 'ACTIVE',
        startTime: { 
          lte: end,
          gt: thirtyMinutesFromNow // 開始前30分鐘的群組不顯示
        },
        endTime: { gt: start }
      },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            coverImage: true,
            halfHourlyRate: true,
            user: {
              select: {
                isSuspended: true,
                suspensionEndsAt: true,
                reviewsReceived: {
                  where: { isApproved: true },
                  select: { rating: true }
                }
              }
            }
          }
        },
        bookings: {
          include: {
            customer: {
              include: { user: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 計算平均評分
    const partnersWithRating = availablePartners.map(partner => {
      const reviews = partner.user.reviewsReceived;
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : 0;

      return {
        ...partner,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount: reviews.length
      };
    });

    // 計算群組預約的評分
    const groupBookingsWithRating = groupBookings.map(group => {
      const reviews = group.partner.user.reviewsReceived;
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : 0;

      return {
        ...group,
        partner: {
          ...group.partner,
          averageRating: Math.round(averageRating * 10) / 10,
          reviewCount: reviews.length
        }
      };
    });

    return NextResponse.json({
      partners: partnersWithRating,
      groupBookings: groupBookingsWithRating
    });

  } catch (error) {
    console.error('獲取可用夥伴失敗:', error);
    return NextResponse.json({ error: '獲取可用夥伴失敗' }, { status: 500 });
  }
}
