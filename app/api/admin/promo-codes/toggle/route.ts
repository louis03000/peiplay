import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為管理員
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { id, isActive } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少優惠碼ID' }, { status: 400 });
    }

    // 更新優惠碼狀態
    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: { isActive }
    });

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error("Error toggling promo code:", error);
    return NextResponse.json({ error: "Error toggling promo code" }, { status: 500 });
  }
} 