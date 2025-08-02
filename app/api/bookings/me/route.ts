import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    let role = session?.user?.role;
    let userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        // 缺少必要欄位，無法自動建立
        return NextResponse.json({ bookings: [] });
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
      },
      include: {
        schedule: { include: { partner: { select: { name: true } } } },
      },
      orderBy: { schedule: { startTime: 'asc' } },
    });
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('GET /api/bookings/me error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Internal Server Error') }, { status: 500 });
  }
} 