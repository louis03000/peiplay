import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("✅ bookings/partner GET api triggered");
    
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
    console.log("🕐 當前時間:", now.toISOString());
    
    const bookings = await prisma.booking.findMany({
      where: {
        schedule: {
          partnerId: partner.id,
          endTime: {
            gte: now // 只顯示未結束的預約
          }
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

    console.log("📊 找到夥伴訂單記錄:", bookings.length);
    console.log("📋 訂單詳情:", bookings.map(b => ({
      id: b.id,
      customerName: b.customer.name,
      endTime: b.schedule.endTime.toISOString(),
      status: b.status,
      isExpired: b.schedule.endTime < now
    })));

    return NextResponse.json({ bookings });

  } catch (error) {
    console.error('❌ 獲取夥伴訂單失敗:', error);
    
    // 返回空數據而不是錯誤，避免前端載入失敗
    return NextResponse.json({ 
      bookings: [],
      error: '獲取夥伴訂單失敗，返回空數據',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    // 確保斷開連線
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
} 