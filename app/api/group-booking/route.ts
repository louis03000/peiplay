import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 創建群組預約
export async function POST(request: Request) {
  try {
    console.log("✅ group-booking POST api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { partnerId, title, description, maxParticipants, pricePerPerson, startTime, endTime } = await request.json();

    if (!partnerId || !title || !startTime || !endTime || !pricePerPerson) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    return await db.query(async (client) => {
      // 查找夥伴資料
      const partner = await client.partner.findUnique({
      where: { id: partnerId },
      include: {
        user: true
      }
    });

      if (!partner) {
        throw new Error('夥伴不存在');
      }

      // 查找用戶資料（明確指定需要的欄位，避免查詢不存在的欄位）
      const user = await client.user.findUnique({
        where: { id: partner.userId },
        select: {
          id: true,
          name: true,
          email: true,
        }
      });

      if (!user) {
        throw new Error('用戶不存在');
      }

      // 使用 transaction 確保原子性
      return await client.$transaction(async (tx) => {
        // 查找或創建客戶記錄（夥伴也需要客戶記錄來參與群組）
        let customer = await tx.customer.findUnique({
          where: { userId: partner.userId }
        });

        if (!customer) {
          try {
            // 為夥伴創建客戶記錄
            customer = await tx.customer.create({
              data: {
                id: `customer-${partner.userId}`,
                name: user.name || '夥伴用戶',
                birthday: new Date('1990-01-01'), // 預設生日
                phone: '0000000000', // 預設電話
                userId: partner.userId
              }
            });
          } catch (error: any) {
            // 如果創建失敗（可能是並發創建），再次查詢
            if (error?.code === 'P2002') {
              customer = await tx.customer.findUnique({
                where: { userId: partner.userId }
              });
            }
            if (!customer) {
              throw error;
            }
          }
        }

        // 創建群組預約
        const groupBooking = await tx.groupBooking.create({
          data: {
            type: 'PARTNER_INITIATED',
            title,
            description: description || null,
            date: new Date(startTime),
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            maxParticipants: maxParticipants || 4,
            currentParticipants: 0,
            pricePerPerson,
            status: 'ACTIVE',
            initiatorId: partner.id,
            initiatorType: 'PARTNER'
          },
          include: {
            GroupBookingParticipant: {
              include: {
                Partner: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        });

        // 創建群組參與者記錄（發起者）
        await tx.groupBookingParticipant.create({
          data: {
            id: `gbp-${groupBooking.id}-${partner.id}`,
            groupBookingId: groupBooking.id,
            customerId: customer.id,
            partnerId: partner.id,
            status: 'ACTIVE'
          }
        });

        // 更新群組預約的當前參與人數（使用 updateMany 避免驗證不存在的欄位）
        await tx.groupBooking.updateMany({
          where: { id: groupBooking.id },
          data: { currentParticipants: 1 }
        });

        // 確保夥伴的 allowGroupBooking 狀態為 true
        await tx.partner.update({
          where: { id: partner.id },
          data: { allowGroupBooking: true }
        });

        console.log("✅ 群組預約創建成功:", groupBooking.id);

        return NextResponse.json({
          success: true,
          groupBooking: {
            id: groupBooking.id,
            partnerId: partner.id,
            title: groupBooking.title,
            description: groupBooking.description,
            maxParticipants: groupBooking.maxParticipants,
            currentParticipants: 1, // 創建者算一個
            pricePerPerson: groupBooking.pricePerPerson,
            startTime: groupBooking.startTime.toISOString(),
            endTime: groupBooking.endTime.toISOString(),
            status: groupBooking.status,
            createdAt: groupBooking.createdAt.toISOString(),
            partner: {
              id: partner.id,
              name: partner.name,
              user: {
                name: user.name
              }
            }
          }
        });
      }, {
        maxWait: 10000, // 等待事務開始的最大時間（10秒）
        timeout: 20000, // 事務執行的最大時間（20秒）
      });
    }, 'group-booking:POST');

  } catch (error) {
    console.error('❌ 創建群組預約失敗:', error);
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    if (error instanceof NextResponse) {
      return error;
    }
    return createErrorResponse(error, 'group-booking:POST');
  }
}

// 獲取群組預約列表
export async function GET(request: Request) {
  try {
    console.log("✅ group-booking GET api triggered");
    
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const status = searchParams.get('status');

    const result = await db.query(async (client) => {
      try {
        // 構建查詢條件
        const where: any = {};
        if (partnerId) {
          where.initiatorId = partnerId;
          where.initiatorType = 'PARTNER';
        }
        if (status) {
          where.status = status;
        }

        // 查詢群組預約
        // 注意：暫時不查詢 games 字段，因為數據庫中可能還沒有這個字段
        const groupBookings = await client.groupBooking.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            date: true,
            startTime: true,
            endTime: true,
            maxParticipants: true,
            currentParticipants: true,
            pricePerPerson: true,
            status: true,
            // games: true, // 暫時移除，因為數據庫中可能還沒有這個字段
            createdAt: true,
            initiatorId: true,
            initiatorType: true,
            GroupBookingParticipant: {
              select: {
                id: true,
                partnerId: true,
                customerId: true,
                Partner: {
                  select: {
                    id: true,
                    name: true,
                    user: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                },
                Customer: {
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
            },
            bookings: {
              select: {
                id: true,
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

        console.log("📊 找到群組預約:", groupBookings.length);

        // 格式化返回數據
        const formattedGroupBookings = groupBookings.map(group => {
          // 找到發起者夥伴
          const initiatorParticipant = group.GroupBookingParticipant.find(p => p.partnerId === group.initiatorId);
          const initiatorPartner = initiatorParticipant?.Partner;
          
          return {
            id: group.id,
            partnerId: group.initiatorId,
            title: group.title,
            description: group.description,
            maxParticipants: group.maxParticipants,
            currentParticipants: group.GroupBookingParticipant.length,
            pricePerPerson: group.pricePerPerson,
            games: (group as any).games || [], // 使用類型斷言，因為數據庫中可能還沒有這個字段
            startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
            endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
            status: group.status,
            createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
            partner: initiatorPartner ? {
              id: initiatorPartner.id,
              name: initiatorPartner.name,
              user: {
                name: initiatorPartner.user.name
              }
            } : {
              id: group.initiatorId,
              name: '未知夥伴',
              user: {
                name: '未知用戶'
              }
            },
            bookings: group.bookings.map(booking => ({
              id: booking.id,
              customer: {
                id: booking.customer.id,
                user: {
                  name: booking.customer.user.name,
                  email: booking.customer.user.email
                }
              }
            }))
          };
        });

        return formattedGroupBookings;
      } catch (queryError: any) {
        console.error('❌ 查詢群組預約時發生錯誤:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta,
        });
        throw queryError;
      }
    }, 'group-booking:GET');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 獲取群組預約失敗:', error);
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return createErrorResponse(error, 'group-booking:GET');
  }
}
