import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";

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

    const result = await db.query(async (client) => {
      // 查詢夥伴
      const partners = await client.partner.findMany({
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
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      const groupBookings = await client.groupBooking.findMany({
        where: {
          status: 'ACTIVE',
          startTime: { 
            lte: end,
            gt: tenMinutesFromNow // 開始前10分鐘的群組不顯示
          },
          endTime: { gt: start }
        },
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          startTime: true,
          endTime: true,
          maxParticipants: true,
          currentParticipants: true,
          pricePerPerson: true,
          status: true,
          initiatorId: true,
          initiatorType: true,
          createdAt: true,
          games: true, // 添加 games 字段
          GroupBookingParticipant: {
            select: {
              id: true,
              customerId: true,
              partnerId: true,
              status: true,
              joinedAt: true,
              Partner: {
                select: {
                  id: true,
                  name: true,
                  coverImage: true,
                  halfHourlyRate: true,
                  games: true, // 添加 games 字段
                  user: {
                    select: {
                      id: true,
                      isSuspended: true,
                      suspensionEndsAt: true,
                      reviewsReceived: {
                        where: { isApproved: true },
                        select: { rating: true }
                      }
                    }
                  }
                }
              }
            }
          },
          bookings: {
            select: {
              id: true,
              customerId: true,
              status: true,
              serviceType: true, // 添加 serviceType 字段
              customer: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
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

    // 計算群組預約的評分並添加遊戲列表和服務類型
    const groupBookingsWithRating = groupBookings.map(group => {
      const partner = group.GroupBookingParticipant.find(p => p.Partner)?.Partner;
      if (!partner) return null;
      
      const reviews = partner.user.reviewsReceived;
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : 0;

      // 判斷服務類型：檢查 bookings 中的 serviceType
      let serviceType = '遊戲'; // 預設為遊戲
      const hasChatOnlyBooking = group.bookings && group.bookings.some((b: any) => b.serviceType === 'CHAT_ONLY');
      if (hasChatOnlyBooking) {
        serviceType = '純聊天';
      }

      // 獲取遊戲列表（優先使用群組的 games，否則使用夥伴的 games）
      const games = (group as any).games && (group as any).games.length > 0 
        ? (group as any).games 
        : (partner?.games || []);

      // 只計算已付款（CONFIRMED）的參與者，未付款不納入「已加入」人數
      const paidParticipantCount = group.bookings
        ? group.bookings.filter((b: any) => b.status === 'CONFIRMED').length
        : 0;

      return {
        ...group,
        currentParticipants: paidParticipantCount,
        games: games, // 添加遊戲列表
        serviceType: serviceType, // 添加服務類型
        partner: {
          ...partner,
          averageRating: Math.round(averageRating * 10) / 10,
          reviewCount: reviews.length
        }
      };
    }).filter(Boolean);

      return {
        partners: partnersWithRating,
        groupBookings: groupBookingsWithRating
      };
    }, 'group-booking/available-partners')

    return NextResponse.json(result);

  } catch (error) {
    console.error('獲取可用夥伴失敗:', error);
    return NextResponse.json({ error: '獲取可用夥伴失敗' }, { status: 500 });
  }
}
