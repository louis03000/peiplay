import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }
  const data = await request.json();
  const { name, phone, birthday, hourlyRate, games, coverImage } = data;
  if (!name || !phone || !birthday) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
  }
  // 1. 更新 User 資料
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone,
      birthday: new Date(birthday),
    },
  });
  // 2. 建立 Partner（如尚未存在）
  const exist = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!exist && hourlyRate && games && coverImage) {
    await prisma.partner.create({
      data: {
        userId: session.user.id,
        name,
        birthday: new Date(birthday),
        phone,
        hourlyRate: parseInt(hourlyRate),
        games,
        coverImage,
      },
    });
  }
  return NextResponse.json({ success: true, user });
} 