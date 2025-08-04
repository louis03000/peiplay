import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為管理員
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const { userId, reason, days = 7 } = await request.json();

    if (!userId || !reason) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 檢查用戶是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 計算停權結束時間
    const suspensionEndsAt = new Date();
    suspensionEndsAt.setDate(suspensionEndsAt.getDate() + days);

    // 更新用戶停權狀態
    await prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspensionEndsAt: suspensionEndsAt
      }
    });

    return NextResponse.json({ 
      message: `用戶已停權 ${days} 天`,
      suspensionEndsAt: suspensionEndsAt
    });
  } catch (error) {
    console.error("Error suspending user:", error);
    return NextResponse.json({ error: "Error suspending user" }, { status: 500 });
  }
} 