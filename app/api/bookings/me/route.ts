import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log("✅ bookings api triggered");
  
  try {
    const session = await getServerSession(authOptions);
    console.log('📝 Session check:', session?.user?.id ? 'User logged in' : 'No user session');
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 檢查是否有 customer 資料，如果沒有就自動建立
    let customer = await prisma.customer.findUnique({ 
      where: { userId: session.user.id }, 
      select: { id: true } 
    });

    if (!customer) {
      // 取得 user 資料
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user || !user.name || !user.birthday || !user.phone) {
        // 缺少必要欄位，回傳明確錯誤
        return NextResponse.json({ error: '請先到個人資料頁面補齊姓名、生日、電話，才能查詢預約紀錄' }, { status: 400 });
      }
      // 自動建立 customer
      customer = await prisma.customer.create({
        data: {
          userId: session.user.id,
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
    
  } catch (error) {
    console.error('❌ Bookings API error:', error);
    return NextResponse.json({ 
      error: (error instanceof Error ? error.message : 'Internal Server Error'),
      bookings: []
    }, { status: 500 });
  }
}