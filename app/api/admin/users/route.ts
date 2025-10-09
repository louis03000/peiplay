import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        role: true,
        isSuspended: true,
        suspensionReason: true,
        suspensionEndsAt: true,
        createdAt: true,
        partner: {
          select: {
            id: true,
            status: true,
            games: true,
            halfHourlyRate: true,
            contractFile: true,
          }
        },
        customer: {
          select: {
            id: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('獲取用戶列表失敗:', error);
    return NextResponse.json(
      { error: '獲取用戶列表失敗' },
      { status: 500 }
    );
  }
}