import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";


export const dynamic = 'force-dynamic';
export async function DELETE(request: Request) {
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

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少優惠碼ID' }, { status: 400 });
    }

    // 刪除優惠碼
    await prisma.promoCode.delete({
      where: { id }
    });

    return NextResponse.json({ message: '優惠碼已刪除' });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    return NextResponse.json({ error: "Error deleting promo code" }, { status: 500 });
  }
} 