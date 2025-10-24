import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log('🚀 Bookings API triggered');
  try {
    const session = await getServerSession(authOptions);
    console.log('📝 Session check:', session?.user?.id ? 'User logged in' : 'No user session');
    let role = session?.user?.role;
    let userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 資料庫連接由 Prisma 自動管理

    // 如果沒有角色信息，從數據庫查詢
    if (!role) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      role = user?.role;
    }

    // 檢查是否有 customer 資料，如果沒有就自動建立
    let customer = await prisma.customer.findUnique({ 
      where: { userId }, 
      select: { id: true } 
    });

    if (!customer) {
      // 取得 user 資料
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.name || !user.birthday || !user.phone) {
        // 缺少必要欄位，回傳明確錯誤
        return NextResponse.json({ error: '請先到個人資料頁面補齊姓名、生日、電話，才能查詢預約紀錄' }, { status: 400 });
      }
      // 自動建立 customer
      customer = await prisma.customer.create({
        data: {
          userId,
          name: user.name,
          birthday: user.birthday,
          phone: user.phone,
        },
        select: { id: true }
      });
    }

    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: {
        customerId: customer.id,
        // 排除群組預約的虛擬 schedule
        scheduleId: { not: 'group-booking-virtual' },
        schedule: { 
          startTime: { gt: now }  // 只顯示未來的預約
        },
      },
      include: {
        schedule: { 
          include: { 
            partner: { select: { name: true } } 
          } 
        },
      },
      orderBy: { schedule: { startTime: 'asc' } },
    });
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('GET /api/bookings/me error:', err);
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (err instanceof Error && err.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試',
        bookings: []
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: (err instanceof Error ? err.message : 'Internal Server Error'),
      bookings: []
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
  }
}