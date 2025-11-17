import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const promoCodes = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      const codes = await client.promoCode.findMany({
        include: {
          partner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return { type: 'SUCCESS', codes } as const;
    }, 'admin:promo-codes:get');

    if (promoCodes.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    return NextResponse.json(promoCodes.codes);
  } catch (error) {
    return createErrorResponse(error, 'admin:promo-codes:get');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const data = await request.json();
    const { code, type, value, maxUses, validFrom, validUntil, description, isActive, partnerId } = data;

    if (!code || !type || value === undefined) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const promoCode = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      const existingCode = await client.promoCode.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (existingCode) {
        return { type: 'DUPLICATE' } as const;
      }

      // 如果指定了partnerId，验证伙伴是否存在
      if (partnerId) {
        const partner = await client.partner.findUnique({
          where: { id: partnerId },
          select: { id: true, status: true },
        });

        if (!partner) {
          return { type: 'PARTNER_NOT_FOUND' } as const;
        }

        if (partner.status !== 'APPROVED') {
          return { type: 'PARTNER_NOT_APPROVED' } as const;
        }
      }

      const created = await client.promoCode.create({
        data: {
          code: code.toUpperCase(),
          type,
          value: parseFloat(value),
          maxUses: maxUses !== undefined ? parseInt(maxUses, 10) || -1 : -1,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validUntil: validUntil ? new Date(validUntil) : null,
          description,
          isActive,
          partnerId: partnerId || null,
        },
      });

      return { type: 'SUCCESS', promoCode: created } as const;
    }, 'admin:promo-codes:create');

    switch (promoCode.type) {
      case 'NOT_ADMIN':
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      case 'DUPLICATE':
        return NextResponse.json({ error: '優惠碼已存在' }, { status: 400 });
      case 'PARTNER_NOT_FOUND':
        return NextResponse.json({ error: '指定的夥伴不存在' }, { status: 400 });
      case 'PARTNER_NOT_APPROVED':
        return NextResponse.json({ error: '指定的夥伴尚未通過審核' }, { status: 400 });
      case 'SUCCESS':
        return NextResponse.json(promoCode.promoCode);
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    return createErrorResponse(error, 'admin:promo-codes:create');
  }
} 