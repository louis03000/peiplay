import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }
  const data = await request.json();
  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name,
        phone: data.phone,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        email: data.email || undefined,
      },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
} 