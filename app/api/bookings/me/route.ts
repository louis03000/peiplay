import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("✅ bookings/me api triggered");
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 查詢當前有效的預約記錄（包含被拒絕的，以便客戶查看拒絕原因）
    const bookings = await prisma.booking.findMany({
      where: { 
        customerId: customer.id,
        status: {
          notIn: ['CANCELLED', 'COMPLETED'] // 保留 REJECTED 狀態，讓客戶能看到拒絕原因
        }
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        rejectReason: true, // 包含拒絕原因
        schedule: {
          include: {
            partner: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log("📊 找到預約記錄:", bookings.length);

    return NextResponse.json({ bookings });

  } catch (error) {
    console.error("❌ 獲取預約記錄失敗:", error);
    
    // 返回空數據而不是錯誤，避免前端載入失敗
    return NextResponse.json({ 
      bookings: [],
      error: '獲取預約記錄失敗，返回空數據',
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