import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";
import { randomBytes } from "crypto";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ favorites: [] });
    }

    const favorites = await db.query(async (client) => {
      // 優化策略：使用批量查詢而非 JOIN
      // 1. 先查詢 customer（使用 userId 索引）
      // 2. 查詢 favoritePartner（不 JOIN Partner，速度更快）
      // 3. 批量查詢所有 Partner（只查詢一次 Partner 表）
      // 4. 在應用層合併資料
      // 這樣可以同時擁有功能和速度
      
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!customer) {
        return [];
      }

      // 第一步：查詢最愛（不 JOIN Partner，速度更快）
      const favoriteRows = await client.favoritePartner.findMany({
        where: { customerId: customer.id },
        select: {
          id: true,
          partnerId: true,
          createdAt: true,
          // 不 JOIN Partner，只獲取 partnerId
        },
        // 使用 createdAt DESC 排序，利用索引
        orderBy: { createdAt: 'desc' },
        // 減少為 50 筆，提升速度
        take: 50,
      });

      // 如果沒有最愛，直接返回空陣列
      if (favoriteRows.length === 0) {
        return [];
      }

      // 第二步：批量查詢所有 Partner（只查詢一次，比 JOIN 快）
      const partnerIds = favoriteRows.map(f => f.partnerId);
      const partners = await client.partner.findMany({
        where: {
          id: { in: partnerIds },
        },
        select: {
          id: true,
          name: true,
        },
      });

      // 建立 partnerId -> partner 的映射
      const partnerMap = new Map(partners.map(p => [p.id, p]));

      // 第三步：在應用層合併資料
      return favoriteRows.map((f) => ({
        id: f.id,
        partnerId: f.partnerId,
        partnerName: partnerMap.get(f.partnerId)?.name || '未知夥伴',
        createdAt: f.createdAt,
      }));
    }, 'favorites:get');

    return NextResponse.json({ favorites });
  } catch (error) {
    if ((error as any)?.code === 'P2021' || (error as any)?.code === '42P01') {
      return NextResponse.json({ favorites: [] });
    }

    return createErrorResponse(error, 'favorites:get');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { partnerId, action } = await request.json();

    if (!partnerId || !action) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json({ error: '無效的操作' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
      });

      if (!customer) {
        return { type: 'CUSTOMER_NOT_FOUND' } as const;
      }

      const partner = await client.partner.findUnique({ where: { id: partnerId } });
      if (!partner) {
        return { type: 'PARTNER_NOT_FOUND' } as const;
      }

      if (action === 'add') {
        const existing = await client.favoritePartner.findUnique({
          where: {
            customerId_partnerId: {
              customerId: customer.id,
              partnerId,
            },
          },
        });

        if (existing) {
          return { type: 'ALREADY_FAVORITE' } as const;
        }

        const id = `fav_${randomBytes(16).toString('hex')}`;
        await client.favoritePartner.create({
          data: {
            id,
            customerId: customer.id,
            partnerId,
          },
        });

        return { type: 'ADDED' } as const;
      }

      await client.favoritePartner.deleteMany({
        where: {
          customerId: customer.id,
          partnerId,
        },
      });

      return { type: 'REMOVED' } as const;
    }, 'favorites:post');

    switch (result.type) {
      case 'CUSTOMER_NOT_FOUND':
        return NextResponse.json({ error: '找不到客戶資料' }, { status: 404 });
      case 'PARTNER_NOT_FOUND':
        return NextResponse.json({ error: '找不到夥伴' }, { status: 404 });
      case 'ALREADY_FAVORITE':
        return NextResponse.json({ message: '已經在最愛列表中', isFavorite: true });
      case 'ADDED':
        return NextResponse.json({ message: '已添加到最愛', isFavorite: true });
      case 'REMOVED':
        return NextResponse.json({ message: '已從最愛移除', isFavorite: false });
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    if ((error as any)?.code === 'P2021' || (error as any)?.code === '42P01') {
      return NextResponse.json({
        error: '最愛功能尚未初始化，請聯繫管理員',
        isFavorite: false,
      }, { status: 503 });
    }

    return createErrorResponse(error, 'favorites:post');
  }
}

