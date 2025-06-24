import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const customer = await prisma.customer.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!customer) return NextResponse.json({ bookings: [] });
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      customerId: customer.id,
      schedule: { startTime: { gt: now } },
    },
    include: {
      schedule: { include: { partner: { select: { name: true } } } },
    },
    orderBy: { schedule: { startTime: 'asc' } },
  });
  return NextResponse.json({ bookings });
} 