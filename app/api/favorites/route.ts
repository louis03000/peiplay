import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import cuid from "cuid";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取用戶的所有最愛夥伴
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 獲取用戶的 Customer ID
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ favorites: [] });
    }

    // 獲取所有最愛夥伴
    const favorites = await prisma.favoritePartner.findMany({
      where: { customerId: customer.id },
      include: {
        Partner: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ 
      favorites: favorites.map(f => ({
        id: f.id,
        partnerId: f.partnerId,
        partnerName: f.Partner.name,
        createdAt: f.createdAt
      }))
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return NextResponse.json({ error: "獲取最愛列表失敗" }, { status: 500 });
  }
}

// 添加或移除最愛
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

    // 獲取用戶的 Customer ID
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '找不到客戶資料' }, { status: 404 });
    }

    // 檢查夥伴是否存在
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: '找不到夥伴' }, { status: 404 });
    }

    if (action === 'add') {
      // 檢查是否已經存在
      const existing = await prisma.favoritePartner.findUnique({
        where: {
          customerId_partnerId: {
            customerId: customer.id,
            partnerId: partnerId
          }
        }
      });

      if (existing) {
        return NextResponse.json({ message: '已經在最愛列表中', isFavorite: true });
      }

      // 生成唯一 ID
      const id = cuid();

      // 添加最愛
      await prisma.favoritePartner.create({
        data: {
          id,
          customerId: customer.id,
          partnerId: partnerId
        }
      });

      return NextResponse.json({ message: '已添加到最愛', isFavorite: true });
    } else {
      // 移除最愛
      await prisma.favoritePartner.deleteMany({
        where: {
          customerId: customer.id,
          partnerId: partnerId
        }
      });

      return NextResponse.json({ message: '已從最愛移除', isFavorite: false });
    }
  } catch (error) {
    console.error("Error managing favorite:", error);
    return NextResponse.json({ error: "操作失敗" }, { status: 500 });
  }
}

