import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { randomBytes } from "crypto";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取用戶的所有最愛夥伴
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ favorites: [] });
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
  } catch (error: any) {
    console.error("Error fetching favorites:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error?.code,
      meta: error?.meta
    });
    
    // 如果是表不存在或其他資料庫錯誤，返回空數組而不是錯誤
    if (error?.code === 'P2021' || error?.code === '42P01') {
      // 表不存在，返回空數組
      return NextResponse.json({ favorites: [] });
    }
    
    // 其他錯誤也返回空數組，避免前端崩潰
    return NextResponse.json({ favorites: [] });
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

      // 生成唯一 ID (使用 crypto.randomBytes 確保在 serverless 環境中可用)
      const id = `fav_${randomBytes(16).toString('hex')}`;

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
  } catch (error: any) {
    console.error("Error managing favorite:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error?.code,
      meta: error?.meta
    });
    
    // 如果是表不存在的錯誤，返回友好訊息
    if (error?.code === 'P2021' || error?.code === '42P01') {
      return NextResponse.json({ 
        error: "最愛功能尚未初始化，請聯繫管理員",
        isFavorite: false
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: "操作失敗",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

