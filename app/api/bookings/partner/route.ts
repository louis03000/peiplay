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

      // 確保資料庫連線
      await prisma.$connect();

      // 查找夥伴資料
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id }
      });

      if (!partner) {
        return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
      }

    // 查詢預約記錄（作為夥伴被預約的記錄）
    // 只顯示未取消、未拒絕、未完成的預約，且排除已過期的預約
    const now = new Date();
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000)); // 轉換為 UTC
    console.log("🕐 當前時間 (Local):", now.toISOString());
    console.log("🕐 當前時間 (UTC):", utcNow.toISOString());
    
    // 先獲取所有預約，然後在前端過濾，確保穩定性
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
            date: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 在前端過濾過期預約，確保時區處理正確
    const validBookings = allBookings.filter(booking => {
      const endTime = new Date(booking.schedule.endTime);
      const isValid = endTime >= now;
      console.log(`📋 訂單 ${booking.id}: endTime=${endTime.toISOString()}, now=${now.toISOString()}, isValid=${isValid}`);
      return isValid;
    });

    console.log("📊 總訂單數:", allBookings.length);
    console.log("📊 有效訂單數:", validBookings.length);

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
    } finally {
      // 確保斷開連線
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error("❌ 斷開連線失敗:", disconnectError);
      }
    }
  }
} 