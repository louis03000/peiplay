import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'PARTNER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id }, select: { id: true } });
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