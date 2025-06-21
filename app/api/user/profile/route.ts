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
    const { name, phone, birthday, discord } = data;

    if (!name || !phone || !birthday) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    // 嚴格 birthday 格式轉換
    let date: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      const [year, month, day] = birthday.split('-');
      date = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      date = new Date(birthday);
    }
    if (!date || isNaN(date.getTime())) {
      return NextResponse.json({ error: '生日格式錯誤，請用 YYYY-MM-DD' }, { status: 400 });
    }

    // 先查 user 是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!existingUser) {
      return NextResponse.json({ error: '找不到使用者' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        phone,
        birthday: date,
        ...(discord !== undefined ? { discord } : {}),
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('補資料 API 失敗:', JSON.stringify(error, null, 2));
    return NextResponse.json({
      error: '補資料失敗',
      detail: error?.message || '未知錯誤',
      stack: error?.stack,
    }, { status: 500 });
  }
} 