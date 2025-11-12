import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { userId, reason, days = 7 } = await request.json();

    if (!userId || !reason) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const admin = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!admin || admin.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      const user = await client.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { type: 'NOT_FOUND' } as const;
      }

      const suspensionEndsAt = new Date();
      suspensionEndsAt.setDate(suspensionEndsAt.getDate() + Number(days || 0));

      await client.user.update({
        where: { id: userId },
        data: {
          isSuspended: true,
          suspensionReason: reason,
          suspensionEndsAt,
        },
      });

      return { type: 'SUCCESS', suspensionEndsAt } as const;
    }, 'admin:users:suspend');

    switch (result.type) {
      case 'NOT_ADMIN':
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      case 'NOT_FOUND':
        return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
      case 'SUCCESS':
        return NextResponse.json({
          message: `用戶已停權 ${days} 天`,
          suspensionEndsAt: result.suspensionEndsAt,
        });
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    return createErrorResponse(error, 'admin:users:suspend');
  }
} 