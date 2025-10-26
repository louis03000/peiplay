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
    const bookings = await prisma.booking.findMany({
      where: {
        schedule: {
          partnerId: partner.id
        }
      },
      include: {
        customer: {
          select: { name: true }
        },
        schedule: {
          select: {
            startTime: true,
            endTime: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log("📊 找到夥伴訂單記錄:", bookings.length);

    return NextResponse.json({ bookings });

  } catch (error) {
    console.error('Bookings partner GET error:', error);
    return NextResponse.json({ 
      error: '獲取夥伴訂單失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    // 確保斷開連線
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
} 