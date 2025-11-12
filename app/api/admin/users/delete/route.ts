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

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '缺少用戶ID' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const admin = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!admin || admin.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      if (userId === session.user.id) {
        return { type: 'SELF_DELETE' } as const;
      }

      const user = await client.user.findUnique({
        where: { id: userId },
        include: {
          partner: true,
          customer: true,
        },
      });

      if (!user) {
        return { type: 'NOT_FOUND' } as const;
      }

      await client.$transaction(async (tx) => {
        if (user.partner) {
          await tx.schedule.deleteMany({ where: { partnerId: user.partner.id } });
        }

        if (user.customer) {
          await tx.booking.deleteMany({ where: { customerId: user.customer.id } });
        }

        await tx.review.deleteMany({
          where: {
            OR: [
              { reviewerId: userId },
              { revieweeId: userId },
            ],
          },
        });

        if (user.customer) {
          await tx.order.deleteMany({ where: { customerId: user.customer.id } });
        }

        if (user.partner) {
          await tx.partner.delete({ where: { id: user.partner.id } });
        }

        if (user.customer) {
          await tx.customer.delete({ where: { id: user.customer.id } });
        }

        await tx.user.delete({ where: { id: userId } });
      });

      return { type: 'SUCCESS' } as const;
    }, 'admin:users:delete');

    switch (result.type) {
      case 'NOT_ADMIN':
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      case 'SELF_DELETE':
        return NextResponse.json({ error: '不能刪除自己的帳號' }, { status: 400 });
      case 'NOT_FOUND':
        return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
      case 'SUCCESS':
        return NextResponse.json({ message: '用戶已成功刪除' });
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    return createErrorResponse(error, 'admin:users:delete');
  }
} 