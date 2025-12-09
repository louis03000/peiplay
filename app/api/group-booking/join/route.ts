import { NextResponse } from "next/server";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 加入群組預約
export async function POST(request: Request) {
  try {
    console.log("✅ group-booking/join POST api triggered");
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { groupBookingId } = await request.json();

    if (!groupBookingId) {
      return NextResponse.json({ error: '缺少群組預約 ID' }, { status: 400 });
    }

    return await db.query(async (client) => {
      // 查找群組預約
      const groupBooking = await client.groupBooking.findUnique({
      where: { id: groupBookingId },
      include: {
        GroupBookingParticipant: true
      }
    });

    if (!groupBooking) {
      return NextResponse.json({ error: '群組預約不存在' }, { status: 404 });
    }

    if (groupBooking.status !== 'ACTIVE') {
      return NextResponse.json({ error: '群組預約已關閉' }, { status: 400 });
    }

    if (groupBooking.GroupBookingParticipant.length >= groupBooking.maxParticipants) {
      return NextResponse.json({ error: '群組預約已滿' }, { status: 400 });
    }

      // 查找用戶資料
      const user = await client.user.findUnique({
        where: { id: session.user.id }
      });

      if (!user) {
        throw new Error('用戶資料不存在');
      }

      // 查找或創建客戶記錄
      let customer = await client.customer.findUnique({
        where: { userId: session.user.id }
      });

      if (!customer) {
        try {
          customer = await client.customer.create({
            data: {
              id: `customer-${session.user.id}`,
              userId: session.user.id,
              name: user.name || '未知客戶',
              birthday: new Date('1990-01-01'),
              phone: '0000000000'
            }
          });
        } catch (createError: any) {
          console.error('❌ 創建客戶記錄失敗:', createError);
          // 如果創建失敗，可能是並發問題，再試一次查找
          if (createError.code !== 'P2002') {
            throw createError;
          }
          customer = await client.customer.findUnique({
            where: { userId: session.user.id }
          });
          if (!customer) {
            throw new Error('無法創建客戶記錄');
          }
        }
      }

      // 檢查是否已經加入
      const existingParticipant = await client.groupBookingParticipant.findFirst({
        where: {
          groupBookingId: groupBookingId,
          customerId: customer.id
        }
      });

      if (existingParticipant) {
        // 如果已經加入，返回成功而不是錯誤（避免重複請求導致的錯誤）
        console.log('✅ 用戶已經加入此群組，返回現有記錄');
        
        // 重新查詢群組以獲取最新數據
        const updatedGroupBooking = await client.groupBooking.findUnique({
          where: { id: groupBookingId },
          include: {
            GroupBookingParticipant: true
          }
        });

        if (updatedGroupBooking) {
          return NextResponse.json({
            success: true,
            message: '您已經在此群組預約中',
            alreadyJoined: true,
            groupBooking: {
              id: updatedGroupBooking.id,
              title: updatedGroupBooking.title,
              description: updatedGroupBooking.description,
              maxParticipants: updatedGroupBooking.maxParticipants,
              currentParticipants: updatedGroupBooking.GroupBookingParticipant.length,
              pricePerPerson: updatedGroupBooking.pricePerPerson,
              status: updatedGroupBooking.status,
              startTime: updatedGroupBooking.startTime.toISOString(),
              endTime: updatedGroupBooking.endTime.toISOString()
            }
          });
        }
        
        return NextResponse.json({ 
          success: true,
          message: '您已經加入此群組預約',
          alreadyJoined: true
        });
      }

      // 使用 transaction 確保原子性
      return await client.$transaction(async (tx) => {
        // 創建群組參與者記錄
        let participant;
        try {
          participant = await tx.groupBookingParticipant.create({
            data: {
              id: `gbp-${groupBookingId}-${customer.id}`,
              groupBookingId: groupBookingId,
              customerId: customer.id,
              status: 'ACTIVE'
            }
          });
          console.log('✅ 群組參與者記錄創建成功');
        } catch (participantError: any) {
          console.error('❌ 創建群組參與者記錄失敗:', participantError);
          
          // 如果是唯一性約束錯誤，可能是並發請求，再檢查一次
          if (participantError.code === 'P2002') {
            const checkAgain = await tx.groupBookingParticipant.findFirst({
              where: {
                groupBookingId: groupBookingId,
                customerId: customer.id
              }
            });
            
            if (checkAgain) {
              // 已經加入了，返回成功
              const updatedGroupBooking = await tx.groupBooking.findUnique({
                where: { id: groupBookingId },
                include: {
                  GroupBookingParticipant: true
                }
              });

              if (updatedGroupBooking) {
                return NextResponse.json({
                  success: true,
                  message: '您已經在此群組預約中',
                  alreadyJoined: true,
                  groupBooking: {
                    id: updatedGroupBooking.id,
                    title: updatedGroupBooking.title,
                    description: updatedGroupBooking.description,
                    maxParticipants: updatedGroupBooking.maxParticipants,
                    currentParticipants: updatedGroupBooking.GroupBookingParticipant.length,
                    pricePerPerson: updatedGroupBooking.pricePerPerson,
                    status: updatedGroupBooking.status,
                    startTime: updatedGroupBooking.startTime.toISOString(),
                    endTime: updatedGroupBooking.endTime.toISOString()
                  }
                });
              }
            }
          }
          throw participantError;
        }

        // 更新群組預約的當前參與人數
        await tx.groupBooking.update({
          where: { id: groupBookingId },
          data: { 
            currentParticipants: groupBooking.GroupBookingParticipant.length + 1
          }
        });

        // 先創建 Schedule 記錄
        let schedule;
        try {
          schedule = await tx.schedule.create({
            data: {
              partnerId: groupBooking.initiatorId,
              date: groupBooking.date,
              startTime: groupBooking.startTime,
              endTime: groupBooking.endTime,
              isAvailable: false
            }
          });
          console.log('✅ Schedule 記錄創建成功');
        } catch (scheduleError: any) {
          console.error('❌ 創建 Schedule 記錄失敗:', scheduleError);
          // 如果是唯一性約束錯誤，可能是已經存在相同的 schedule
          if (scheduleError.code === 'P2002') {
            // 嘗試查找現有的 schedule
            schedule = await tx.schedule.findFirst({
              where: {
                partnerId: groupBooking.initiatorId,
                date: groupBooking.date,
                startTime: groupBooking.startTime,
                endTime: groupBooking.endTime
              }
            });
            
            if (!schedule) {
              throw scheduleError;
            }
            console.log('✅ 找到現有的 Schedule 記錄');
          } else {
            throw scheduleError;
          }
        }

        // 創建 Booking 記錄（用於顯示在「我的預約」中）
        let booking;
        try {
          booking = await tx.booking.create({
            data: {
              id: `booking-${Date.now()}`,
              customerId: customer.id,
              partnerId: groupBooking.initiatorId,
              scheduleId: schedule.id,
              status: 'CONFIRMED',
              originalAmount: groupBooking.pricePerPerson || 0,
              finalAmount: groupBooking.pricePerPerson || 0,
              isGroupBooking: true,
              groupBookingId: groupBookingId
            },
            include: {
              schedule: {
                include: {
                  partner: {
                    select: { name: true }
                  }
                }
              }
            }
          });
          console.log('✅ Booking 記錄創建成功');
        } catch (bookingError: any) {
          console.error('❌ 創建 Booking 記錄失敗:', bookingError);
          
          // 如果是唯一性約束錯誤（scheduleId 必須唯一），檢查是否已經有 booking
          if (bookingError.code === 'P2002') {
            const existingBooking = await tx.booking.findFirst({
              where: {
                scheduleId: schedule.id,
                customerId: customer.id,
                groupBookingId: groupBookingId
              }
            });
            
            if (existingBooking) {
              booking = existingBooking;
              console.log('✅ 找到現有的 Booking 記錄');
            } else {
              // 嘗試使用不同的 schedule 或創建新的 schedule
              throw bookingError;
            }
          } else {
            // 對於其他錯誤，嘗試繼續（因為主要操作已完成）
            console.warn('⚠️ Booking 記錄創建失敗，但參與者已加入群組');
          }
        }

        // 重新查詢群組以獲取最新的參與人數
        const updatedGroupBooking = await tx.groupBooking.findUnique({
          where: { id: groupBookingId },
          include: {
            GroupBookingParticipant: true
          }
        });

        console.log("✅ 成功加入群組預約:", groupBookingId);

        return NextResponse.json({
          success: true,
          message: '成功加入群組預約',
          groupBooking: {
            id: updatedGroupBooking?.id || groupBooking.id,
            title: updatedGroupBooking?.title || groupBooking.title,
            description: updatedGroupBooking?.description || groupBooking.description,
            maxParticipants: updatedGroupBooking?.maxParticipants || groupBooking.maxParticipants,
            currentParticipants: updatedGroupBooking?.GroupBookingParticipant.length || (groupBooking.GroupBookingParticipant.length + 1),
            pricePerPerson: updatedGroupBooking?.pricePerPerson || groupBooking.pricePerPerson,
            status: updatedGroupBooking?.status || groupBooking.status,
            startTime: updatedGroupBooking?.startTime.toISOString() || groupBooking.startTime.toISOString(),
            endTime: updatedGroupBooking?.endTime.toISOString() || groupBooking.endTime.toISOString()
          },
          booking: booking ? {
            id: booking.id,
            status: booking.status,
            createdAt: booking.createdAt.toISOString()
          } : null
        });
      });
    }, 'group-booking/join');

  } catch (error: any) {
    console.error('❌ 加入群組預約失敗:', error);
    console.error('❌ 錯誤詳情:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    });
    
    // 處理 Prisma 錯誤
    if (error?.code) {
      switch (error.code) {
        case 'P2002':
          // 唯一性約束錯誤 - 可能是並發請求導致
          return NextResponse.json({ 
            error: '您可能已經加入此群組',
            details: '請重新整理頁面確認',
            code: 'ALREADY_JOINED'
          }, { status: 409 });
        case 'P2003':
          return NextResponse.json({ 
            error: '關聯資料不存在',
            details: '群組預約或相關資料不存在'
          }, { status: 400 });
        case 'P2025':
          return NextResponse.json({ 
            error: '記錄不存在',
            details: '找不到要操作的記錄'
          }, { status: 404 });
        default:
          return NextResponse.json({ 
            error: '加入失敗',
            details: error.message || '請稍後再試'
          }, { status: 500 });
      }
    }
    
    // 處理其他錯誤（包括 NextResponse）
    if (error instanceof NextResponse) {
      return error;
    }
    
    // 處理其他錯誤
    return NextResponse.json({ 
      error: '加入群組預約失敗',
      details: error instanceof Error ? error.message : '未知錯誤，請稍後再試'
    }, { status: 500 });
  }
}