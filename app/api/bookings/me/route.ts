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
    if (!role && userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      role = user?.role;
    }
    if (!userId || role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
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
  } catch (err) {
    console.error('GET /api/bookings/me error:', err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : 'Internal Server Error') }, { status: 500 });
  }
} 