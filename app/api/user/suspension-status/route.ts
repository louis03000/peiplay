import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        isSuspended: true,
        suspensionReason: true,
        suspensionEndsAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    const now = new Date();
    const isCurrentlySuspended = user.isSuspended && 
      user.suspensionEndsAt && 
      new Date(user.suspensionEndsAt) > now;

    return NextResponse.json({
      isSuspended: isCurrentlySuspended,
      suspensionReason: user.suspensionReason,
      suspensionEndsAt: user.suspensionEndsAt,
      remainingDays: isCurrentlySuspended && user.suspensionEndsAt 
        ? Math.ceil((new Date(user.suspensionEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0
    });
  } catch (error) {
    console.error("Error checking suspension status:", error);
    return NextResponse.json({ error: "Error checking suspension status" }, { status: 500 });
  }
} 