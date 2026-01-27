import { NextResponse } from "next/server";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { sendBookingNotificationEmail, sendGroupBookingJoinNotification } from "@/lib/email";
import { getNowTaipei, addTaipeiTime } from "@/lib/time-utils";

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

    const result = await db.query(async (client) => {
      // 查找群組預約（明確指定需要的欄位，避免查詢不存在的欄位）
      const groupBooking = await client.groupBooking.findUnique({
        where: { id: groupBookingId },
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
          updatedAt: true,
          GroupBookingParticipant: {
            select: {
              id: true,
              customerId: true,
              partnerId: true,
              status: true,
              joinedAt: true,
            }
          }
        }
      });

    if (!groupBooking) {
      return NextResponse.json({ error: '群組預約不存在' }, { status: 404 });
    }

    if (groupBooking.status !== 'ACTIVE') {
      return NextResponse.json({ error: '群組預約已關閉' }, { status: 400 });
    }

    // 檢查時間是否已過（使用台灣時間）
    const now = getNowTaipei();
    const endTime = new Date(groupBooking.endTime);
    const startTime = new Date(groupBooking.startTime);
    
    // 檢查結束時間是否已過
    if (endTime.getTime() <= now.getTime()) {
      return NextResponse.json({ error: '群組預約時間已過，無法加入' }, { status: 400 });
    }
    
    // 檢查剩餘時間是否少於10分鐘（開始時間必須在10分鐘後）
    const tenMinutesLater = addTaipeiTime(now, 10, 'minute');
    if (startTime.getTime() <= tenMinutesLater.getTime()) {
      return NextResponse.json({ error: '群組預約即將開始，剩餘時間不足10分鐘，無法加入' }, { status: 400 });
    }

    // maxParticipants 表示除了夥伴之外的參與者數量
    // 總人數 = maxParticipants + 1（夥伴）
    // 所以檢查時應該：參與者數量（包括夥伴）<= maxParticipants + 1
    // 但因為夥伴已經在 GroupBookingParticipant 中，所以檢查：參與者數量 <= maxParticipants + 1
    // 或者更簡單：除了夥伴之外的參與者數量 < maxParticipants
    const nonPartnerParticipants = groupBooking.GroupBookingParticipant.filter(
      p => !p.partnerId || p.partnerId !== groupBooking.initiatorId
    );
    if (nonPartnerParticipants.length >= groupBooking.maxParticipants) {
      return NextResponse.json({ error: '群組預約已滿' }, { status: 400 });
    }

      // 查找用戶資料（明確指定需要的欄位，避免查詢不存在的欄位）
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
        }
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
            GroupBookingParticipant: {
              select: {
                id: true,
                customerId: true,
                partnerId: true,
                status: true,
                joinedAt: true,
              }
            }
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
                  GroupBookingParticipant: {
                    select: {
                      id: true,
                      customerId: true,
                      partnerId: true,
                      status: true,
                      joinedAt: true,
                    }
                  }
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

        // 更新群組預約的當前參與人數（使用 updateMany 避免驗證不存在的欄位）
        await tx.groupBooking.updateMany({
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
          // 先創建 booking（不設置 orderNumber），然後使用生成的 id 來生成訂單編號
          // 這樣可以確保訂單編號格式與其他預約類型一致（ORD-{id前8位大寫}）
          booking = await tx.booking.create({
            data: {
              // 移除手動設置的 id，讓 Prisma 使用默認的 cuid() 生成
              customerId: customer.id,
              partnerId: groupBooking.initiatorId,
              scheduleId: schedule.id,
              status: 'CONFIRMED',
              originalAmount: groupBooking.pricePerPerson || 0,
              finalAmount: groupBooking.pricePerPerson || 0,
              isGroupBooking: true,
              groupBookingId: groupBookingId,
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
          
          // 使用生成的 booking.id 來生成訂單編號（與其他預約類型保持一致）
          const orderNumber = `ORD-${booking.id.substring(0, 8).toUpperCase()}`
          
          // 更新 booking 設置訂單編號
          booking = await tx.booking.update({
            where: { id: booking.id },
            data: { orderNumber },
          });
          
          console.log('✅ Booking 記錄創建成功，訂單編號:', orderNumber);
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
            GroupBookingParticipant: {
              select: {
                id: true,
                customerId: true,
                partnerId: true,
                status: true,
                joinedAt: true,
              }
            }
          }
        });

        console.log("✅ 成功加入群組預約:", groupBookingId);

        // 確保日期是 Date 對象並轉換為 ISO 字符串
        const startTimeResponse = updatedGroupBooking?.startTime instanceof Date 
          ? updatedGroupBooking.startTime 
          : new Date(updatedGroupBooking?.startTime || groupBooking.startTime);
        const endTimeResponse = updatedGroupBooking?.endTime instanceof Date 
          ? updatedGroupBooking.endTime 
          : new Date(updatedGroupBooking?.endTime || groupBooking.endTime);
        
        // 準備 email 發送所需的資料（在事務內準備，但不在事務內發送）
        const emailData = {
          groupBookingId,
          userEmail: user.email,
          userName: user.name || '您',
          startTime: startTimeResponse,
          endTime: endTimeResponse,
          pricePerPerson: updatedGroupBooking?.pricePerPerson || groupBooking.pricePerPerson || 0,
          initiatorId: groupBooking.initiatorId,
          groupBookingTitle: updatedGroupBooking?.title || groupBooking.title || '未命名群組',
          currentParticipants: updatedGroupBooking?.GroupBookingParticipant.length || (groupBooking.GroupBookingParticipant.length + 1),
          maxParticipants: updatedGroupBooking?.maxParticipants || groupBooking.maxParticipants,
        };
        
        // 返回成功響應（事務會在這裡提交）
        return {
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
            startTime: startTimeResponse.toISOString(),
            endTime: endTimeResponse.toISOString()
          },
          booking: booking ? {
            id: booking.id,
            status: booking.status,
            createdAt: booking.createdAt instanceof Date ? booking.createdAt.toISOString() : new Date(booking.createdAt).toISOString()
          } : null,
          emailData // 傳遞 email 資料到事務外部
        };
      });
    }, 'group-booking/join');

    // 檢查結果類型，確保只有成功的情況才發送 email
    // 如果 result 是 NextResponse（錯誤響應），直接返回，不發送 email
    if (result instanceof NextResponse) {
      console.log('⚠️ 加入失敗，不發送 email，返回錯誤響應');
      return result;
    }

    // 檢查是否為成功響應（必須有 success: true 和 emailData）
    if (
      result && 
      typeof result === 'object' && 
      'success' in result && 
      result.success === true && 
      'emailData' in result &&
      !('alreadyJoined' in result && result.alreadyJoined === true) // 如果已經加入，不發送 email
    ) {
      const emailData = result.emailData as {
        groupBookingId: string;
        userEmail: string;
        userName: string;
        startTime: Date;
        endTime: Date;
        pricePerPerson: number;
        initiatorId: string | null;
        groupBookingTitle: string;
        currentParticipants: number;
        maxParticipants: number;
      };
      
      console.log('✅ 事務成功，準備發送 email 通知');
      
      // ⚠️ 注意：不再在加入群组时发送通知给伙伴
      // 通知将在支付成功后发送（见 /api/payment/callback）
      console.log("ℹ️ 群組預約已加入，等待付款完成後再發送通知給夥伴");
      
      // 仍然发送加入确认通知给加入者（这是给用户的确认，不是给伙伴的预约通知）
      sendGroupBookingJoinNotification(
        emailData.userEmail,
        emailData.userName,
        emailData.groupBookingTitle,
        {
          startTime: emailData.startTime.toISOString(),
          endTime: emailData.endTime.toISOString(),
          pricePerPerson: emailData.pricePerPerson,
          currentParticipants: emailData.currentParticipants,
          maxParticipants: emailData.maxParticipants,
        }
      ).catch((error) => {
        console.error('❌ 群組加入確認通知 Email 發送失敗:', error);
      });

      // 返回成功響應（移除 emailData）
      const { emailData: _, ...responseData } = result;
      return NextResponse.json(responseData);
    }

    // 其他情況（可能是錯誤響應或未知格式），不發送 email，直接返回
    console.log('⚠️ 未知的響應格式，不發送 email');
    if (result && typeof result === 'object' && 'error' in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ error: '加入失敗', details: '未知錯誤' }, { status: 500 });

  } catch (error: any) {
    console.error('❌ 加入群組預約失敗:', error);
    console.error('❌ 錯誤詳情:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    });
    
    // 重要：確保在錯誤情況下不發送 email
    // 所有錯誤都會在這裡被捕獲，不會執行 email 發送邏輯
    
    // 處理 Circuit Breaker 錯誤
    if (error?.message?.includes('Circuit breaker is OPEN')) {
      return NextResponse.json({ 
        error: '加入群組預約失敗',
        details: '資料庫暫時無法使用，請稍後再試'
      }, { status: 503 }); // 503 Service Unavailable
    }
    
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
        case 'P1008':
        case 'P1017':
          // 資料庫連接錯誤
          return NextResponse.json({ 
            error: '加入群組預約失敗',
            details: '資料庫連接失敗，請稍後再試'
          }, { status: 503 });
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