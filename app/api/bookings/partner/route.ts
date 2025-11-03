import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`✅ bookings/partner GET api triggered (attempt ${retryCount + 1})`);
      
      // 檢查認證
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: '請先登入' }, { status: 401 });
      }

      // 查找夥伴資料
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id }
      });

      if (!partner) {
        return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
      }

    // 查詢預約記錄（作為夥伴被預約的記錄）
    // 只顯示未取消、未拒絕、未完成的預約
    const now = new Date();
    console.log("🕐 當前時間:", now.toISOString());
    
    // 查詢所有未取消、未拒絕、未完成的預約
    // 特別包含狀態為 PAID_WAITING_PARTNER_CONFIRMATION 的訂單
    const allBookings = await prisma.booking.findMany({
      where: {
        schedule: {
          partnerId: partner.id
        },
        status: {
          notIn: ['CANCELLED', 'REJECTED', 'COMPLETED'] // 排除已取消、已拒絕、已完成的預約
        }
      },
      include: {
        customer: {
          select: { name: true }
        },
        schedule: {
          select: {
            startTime: true,
            endTime: true,
            date: true,
            partnerId: true // 確保包含 partnerId 用於驗證
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log("📊 查詢到的總訂單數:", allBookings.length);
    
    // 過濾過期預約（只過濾已結束的預約，保留未開始或進行中的）
    // 對於 PAID_WAITING_PARTNER_CONFIRMATION 狀態的訂單，即使時間稍過，也應該顯示給夥伴確認
    const validBookings = allBookings.filter(booking => {
      const endTime = new Date(booking.schedule.endTime);
      // 允許時間偏差：如果訂單狀態是等待夥伴確認，即使已經過了幾分鐘，也應該顯示
      // 因為夥伴可能還沒來得及確認
      const timeBuffer = booking.status === 'PAID_WAITING_PARTNER_CONFIRMATION' 
        ? 30 * 60 * 1000 // 等待確認的訂單允許30分鐘緩衝
        : 0;
      const isValid = endTime.getTime() >= (now.getTime() - timeBuffer);
      
      console.log(`📋 訂單 ${booking.id}: status=${booking.status}, endTime=${endTime.toISOString()}, now=${now.toISOString()}, isValid=${isValid}`);
      return isValid;
    });

    console.log("📊 過濾後的有效訂單數:", validBookings.length);
    console.log("📊 訂單狀態分佈:", validBookings.map(b => b.status));

      return NextResponse.json({ bookings: validBookings });

    } catch (error) {
      retryCount++;
      console.error(`❌ 獲取夥伴訂單失敗 (attempt ${retryCount}):`, error);
      
      // 如果是最後一次重試，返回空數據而不是錯誤
      if (retryCount >= maxRetries) {
        console.error("❌ 所有重試都失敗了，返回空數據");
        return NextResponse.json({ 
          bookings: [],
          error: '獲取夥伴訂單失敗，返回空數據',
          details: error instanceof Error ? error.message : 'Unknown error',
          retryAttempts: retryCount
        });
      }
      
      // 等待一段時間後重試
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  // 如果所有重試都失敗了
  return NextResponse.json({ 
    bookings: [],
    error: '獲取夥伴訂單失敗',
  });
} 