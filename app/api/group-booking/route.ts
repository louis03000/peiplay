import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { sendBookingNotificationEmail } from "@/lib/email";
import { parseTaipeiDateTime, getNowTaipei, addTaipeiTime } from "@/lib/time-utils";

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

    const { partnerId, title, description, maxParticipants, pricePerPerson, startTime, endTime, games } = await request.json();

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

        // 創建群組預約（使用台灣時區解析時間）
        const groupBooking = await tx.groupBooking.create({
          data: {
            type: 'PARTNER_INITIATED',
            title,
            description: description || null,
            date: parseTaipeiDateTime(startTime),
            startTime: parseTaipeiDateTime(startTime),
            endTime: parseTaipeiDateTime(endTime),
            maxParticipants: maxParticipants || 4,
            currentParticipants: 0,
            pricePerPerson,
            status: 'ACTIVE',
            initiatorId: partner.id,
            initiatorType: 'PARTNER',
            games: Array.isArray(games) ? games : [] // 保存選擇的遊戲
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

        // 發送 email 通知給發起者（非阻塞）
        sendBookingNotificationEmail(
          user.email,
          user.name || partner.name || '夥伴',
          user.name || partner.name || '您',
          {
            bookingId: groupBooking.id,
            startTime: groupBooking.startTime.toISOString(),
            endTime: groupBooking.endTime.toISOString(),
            duration: (groupBooking.endTime.getTime() - groupBooking.startTime.getTime()) / (1000 * 60 * 60),
            totalCost: groupBooking.pricePerPerson || 0,
            customerName: user.name || partner.name || '您',
            customerEmail: user.email,
          }
        ).catch((error) => {
          console.error('❌ Email 發送失敗:', error);
        });

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
    
    // 獲取當前用戶的 session（如果有）
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id;

    const result = await db.query(async (client) => {
      try {
        // 使用台灣時間
        let now: Date;
        let tenMinutesLater: Date;
        
        try {
          now = getNowTaipei();
          console.log(`🔍 [群組預約查詢] getNowTaipei() 返回: ${now}, isValid: ${!(isNaN(now.getTime()))}`);
        } catch (error: any) {
          console.error('❌ [群組預約查詢] getNowTaipei() 失敗:', error);
          throw new Error(`獲取當前時間失敗: ${error.message}`);
        }
        
        // 驗證 now 是否為有效的 Date 對象
        if (!(now instanceof Date) || isNaN(now.getTime())) {
          throw new Error(`當前時間無效: now=${now}, type=${typeof now}`);
        }
        
        try {
          // 計算10分鐘後的時間（剩餘時間少於10分鐘的群組也要過濾掉）
          tenMinutesLater = addTaipeiTime(now, 10, 'minute');
          console.log(`🔍 [群組預約查詢] addTaipeiTime() 返回: ${tenMinutesLater}, isValid: ${!(isNaN(tenMinutesLater.getTime()))}`);
        } catch (error: any) {
          console.error('❌ [群組預約查詢] addTaipeiTime() 失敗:', error);
          throw new Error(`計算10分鐘後時間失敗: ${error.message}, now=${now}`);
        }
        
        // 驗證 tenMinutesLater 是否為有效的 Date 對象
        if (!(tenMinutesLater instanceof Date) || isNaN(tenMinutesLater.getTime())) {
          throw new Error(`10分鐘後時間無效: tenMinutesLater=${tenMinutesLater}, now=${now}`);
        }
        
        console.log(`🔍 [群組預約查詢] 當前時間: ${now.toISOString()}, 10分鐘後: ${tenMinutesLater.toISOString()}`);
        
        // 構建查詢條件
        const where: any = {};
        if (partnerId) {
          where.initiatorId = partnerId;
          where.initiatorType = 'PARTNER';
        }
        // 如果沒有指定狀態，默認只查詢 ACTIVE 狀態的群組預約
        if (status) {
          where.status = status;
        } else {
          where.status = 'ACTIVE';
        }
        // 過濾條件：
        // 1. 結束時間必須在未來（還沒結束）
        // 2. 開始時間必須在10分鐘後（剩餘時間至少10分鐘才能加入）
        // 使用 gte 來包含正好10分鐘後的預約
        where.endTime = { gt: now };
        where.startTime = { gte: tenMinutesLater };
        
        console.log(`🔍 [群組預約查詢] 查詢條件:`, JSON.stringify({
          status: where.status,
          initiatorId: where.initiatorId,
          initiatorType: where.initiatorType,
          endTime: where.endTime.gt?.toISOString(),
          startTime: where.startTime.gte?.toISOString()
        }, null, 2));

        // 查詢群組預約（包含 games 字段）
        console.log('🔍 [群組預約查詢] 開始執行 Prisma 查詢...');
        let groupBookings: any[];
        try {
          groupBookings = await client.groupBooking.findMany({
            where,
            orderBy: { createdAt: 'desc' },
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
            games: true, // 查詢群組預約保存的遊戲列表
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
                    coverImage: true,
                    halfHourlyRate: true,
                    games: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
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
                status: true,
                serviceType: true,
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
          }
          });
          console.log(`✅ [群組預約查詢] Prisma 查詢成功，找到 ${groupBookings.length} 個群組預約`);
        } catch (prismaError: any) {
          console.error('❌ [群組預約查詢] Prisma 查詢失敗:', {
            message: prismaError?.message,
            code: prismaError?.code,
            meta: prismaError?.meta,
            stack: prismaError?.stack,
          });
          // 返回空數組，避免整個請求失敗
          groupBookings = [];
        }

        console.log(`📊 找到群組預約: ${groupBookings.length} 個`);
        if (groupBookings.length > 0) {
          console.log(`📋 群組預約列表:`, groupBookings.map(gb => ({
            id: gb.id,
            title: gb.title,
            startTime: gb.startTime instanceof Date ? gb.startTime.toISOString() : gb.startTime,
            endTime: gb.endTime instanceof Date ? gb.endTime.toISOString() : gb.endTime,
            status: gb.status
          })));
        }

        // 格式化返回數據
        const formattedGroupBookings = groupBookings.map(group => {
          try {
            // 找到發起者夥伴
            const initiatorParticipant = group.GroupBookingParticipant.find((p: any) => p.partnerId === group.initiatorId);
            const initiatorPartner = initiatorParticipant?.Partner;
            
            // 計算平均評分（從 user.reviewsReceived 獲取）
            let averageRating = 0;
            let reviewCount = 0;
            if (initiatorPartner?.user?.reviewsReceived && initiatorPartner.user.reviewsReceived.length > 0) {
              const ratings = initiatorPartner.user.reviewsReceived.map((r: any) => r.rating);
              averageRating = ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length;
              reviewCount = ratings.length;
            }
            
            // 判斷服務類型：檢查 bookings 中的 serviceType
            let serviceType = '遊戲'; // 預設為遊戲
            const hasChatOnlyBooking = group.bookings && group.bookings.some((b: any) => b.serviceType === 'CHAT_ONLY');
            if (hasChatOnlyBooking) {
              serviceType = '純聊天';
            }
            
            // 獲取遊戲列表（優先使用群組預約保存的 games，如果沒有則不顯示遊戲）
            const games = (group as any).games && Array.isArray((group as any).games) && (group as any).games.length > 0 
              ? (group as any).games 
              : [];
            
            // 查找當前用戶的 booking（如果已登入）
            let myBookingId: string | undefined;
            let myBookingStatus: string | undefined;
            if (currentUserId && group.bookings) {
              const myBooking = group.bookings.find((b: any) => 
                b.customer?.user?.id === currentUserId
              );
              if (myBooking) {
                myBookingId = myBooking.id;
                myBookingStatus = myBooking.status;
              }
            }
            
            return {
              id: group.id,
              partnerId: group.initiatorId,
              title: group.title,
              description: group.description,
              maxParticipants: group.maxParticipants,
              currentParticipants: group.GroupBookingParticipant.length,
              pricePerPerson: group.pricePerPerson,
              games: games,
              serviceType: serviceType, // 添加服務類型
              startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
              endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
              status: group.status,
              createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
              myBookingId, // 當前用戶的 booking ID
              myBookingStatus, // 當前用戶的 booking 狀態
              partner: initiatorPartner && initiatorPartner.user ? {
                id: initiatorPartner.id,
                name: initiatorPartner.name,
                coverImage: initiatorPartner.coverImage || '',
                halfHourlyRate: initiatorPartner.halfHourlyRate || 0,
                games: initiatorPartner.games || [],
                averageRating,
                reviewCount,
                allowGroupBooking: true,
                user: {
                  email: initiatorPartner.user.email || '',
                  isSuspended: initiatorPartner.user.isSuspended || false,
                  suspensionEndsAt: initiatorPartner.user.suspensionEndsAt
                }
              } : {
                id: group.initiatorId,
                name: '未知夥伴',
                coverImage: '',
                halfHourlyRate: 0,
                games: [],
                averageRating: 0,
                reviewCount: 0,
                allowGroupBooking: false,
                user: {
                  email: '',
                  isSuspended: false,
                  suspensionEndsAt: null
                }
              },
              bookings: group.bookings.map((booking: any) => ({
                id: booking.id,
                customer: {
                  id: booking.customer.id,
                  user: {
                    name: booking.customer.user?.name || '',
                    email: booking.customer.user?.email || ''
                  }
                }
              }))
            };
          } catch (formatError: any) {
            console.error(`❌ 格式化群組預約 ${group.id} 時發生錯誤:`, formatError);
            // 返回一個基本的格式，避免整個請求失敗
            return {
              id: group.id,
              partnerId: group.initiatorId,
              title: group.title || '未知標題',
              description: group.description,
              maxParticipants: group.maxParticipants,
              currentParticipants: group.GroupBookingParticipant?.length || 0,
              pricePerPerson: group.pricePerPerson,
              games: [],
              startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
              endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
              status: group.status,
              createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
              partner: {
                id: group.initiatorId,
                name: '未知夥伴',
                coverImage: '',
                halfHourlyRate: 0,
                games: [],
                averageRating: 0,
                reviewCount: 0,
                allowGroupBooking: false,
                user: {
                  email: '',
                  isSuspended: false,
                  suspensionEndsAt: null
                }
              },
              bookings: []
            };
          }
        });

        return formattedGroupBookings;
      } catch (queryError: any) {
        console.error('❌ 查詢群組預約時發生錯誤:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta,
          stack: queryError?.stack,
          name: queryError?.name,
        });
        // 重新拋出錯誤，讓外層處理
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
