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
      // 優化策略：
      // 1. 先查詢 customer（使用 userId 索引）
      // 2. 查詢 favoritePartner（使用 customerId 索引）
      // 3. 如果沒有最愛，直接返回空陣列，避免不必要的 JOIN
      // 4. 只查詢必要的 Partner 欄位
      
      const customer = await client.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!customer) {
        return [];
      }

      // 進一步優化：直接查詢，移除 count 檢查（減少一次查詢）
      // 使用索引優化的查詢：customerId 索引 + createdAt 排序
      // 只查詢必要的欄位，減少資料傳輸
      const rows = await client.favoritePartner.findMany({
        where: { customerId: customer.id },
        select: {
          id: true,
          partnerId: true,
          createdAt: true,
          Partner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        // 使用 createdAt DESC 排序，利用索引
        orderBy: { createdAt: 'desc' },
        // 減少為 50 筆，提升速度
        take: 50,
      });

      // 如果沒有最愛，直接返回空陣列
      if (rows.length === 0) {
        return [];
      }

      // 在應用層映射資料，減少資料庫處理
      return rows.map((f) => ({
        id: f.id,
        partnerId: f.partnerId,
        partnerName: f.Partner?.name || '未知夥伴',
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

