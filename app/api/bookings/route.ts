import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Handles the creation of new bookings.
 */
export async function POST(request: Request) {
  try {
    console.log("✅ bookings POST api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { scheduleIds } = await request.json();

    if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ error: 'Valid schedule IDs were not provided' }, { status: 400 });
    }

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 創建預約記錄
    const bookings = await Promise.all(
      scheduleIds.map(async (scheduleId: string) => {
        return await prisma.booking.create({
          data: {
            customerId: customer.id,
            scheduleId: scheduleId,
            status: 'CONFIRMED',
            originalAmount: 0, // 需要從 schedule 計算
            finalAmount: 0
          }
        });
      })
    );

    return NextResponse.json({
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        message: '預約創建成功'
      }))
    });

  } catch (error) {
    console.error('預約創建失敗:', error);
    return NextResponse.json({ 
      error: '預約創建失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Fetches bookings based on the user's role.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("✅ bookings GET api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 查詢預約記錄
    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.id },
      include: {
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

    return NextResponse.json({ bookings });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({
      error: '獲取預約記錄失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 