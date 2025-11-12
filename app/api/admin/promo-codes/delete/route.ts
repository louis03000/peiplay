import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少優惠碼ID' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      await client.promoCode.delete({ where: { id } });

      return { type: 'SUCCESS' } as const;
    }, 'admin:promo-codes:delete');

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    return NextResponse.json({ message: '優惠碼已刪除' });
  } catch (error) {
    return createErrorResponse(error, 'admin:promo-codes:delete');
  }
} 