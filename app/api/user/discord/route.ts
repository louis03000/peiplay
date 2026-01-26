import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * 僅更新使用者的 Discord 名稱（用於 Google 登入後強制填寫）
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const discord = typeof data.discord === 'string' ? data.discord.trim() : '';

    if (!discord || discord.length < 2) {
      return NextResponse.json({ error: '請輸入 Discord 名稱（至少 2 個字元）' }, { status: 400 });
    }
    if (discord.length > 32) {
      return NextResponse.json({ error: 'Discord 名稱不可超過 32 個字元' }, { status: 400 });
    }
    if (!/^.{2,32}$/.test(discord)) {
      return NextResponse.json({ error: 'Discord 名稱格式不正確' }, { status: 400 });
    }

    const updated = await db.query(async (client) => {
      const user = await client.user.update({
        where: { id: session.user!.id },
        data: { discord },
        select: { id: true, discord: true },
      });
      return user;
    }, 'user:discord:update');

    return NextResponse.json({ success: true, discord: updated.discord });
  } catch (error) {
    return createErrorResponse(error, 'user:discord:update');
  }
}
