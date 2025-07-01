import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // 只要有 partner 資料即可查詢
  const partner = await prisma.partner.findUnique({ where: { userId }, select: { id: true } });
  if (!partner) return NextResponse.json({ bookings: [] });
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      schedule: { partnerId: partner.id, startTime: { gt: now } },
    },
    include: {
      customer: { select: { name: true } },
      schedule: true,
    },
    orderBy: { schedule: { startTime: 'asc' } },
  });
  return NextResponse.json({ bookings });
} 