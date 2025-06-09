import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const { name, phone, birthday } = data;
    if (!name || !phone || !birthday) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        phone,
        birthday: new Date(birthday),
      },
    });
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('補資料 API 失敗:', error);
    return NextResponse.json({ error: '補資料失敗', detail: error.message }, { status: 500 });
  }
} 