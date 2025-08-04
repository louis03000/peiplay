import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function DELETE(request: Request) {
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

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '缺少用戶ID' }, { status: 400 });
    }

    // 檢查用戶是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partner: true,
        customer: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 防止刪除自己
    if (userId === session.user.id) {
      return NextResponse.json({ error: '不能刪除自己的帳號' }, { status: 400 });
    }

    // 使用事務刪除用戶及其相關資料
    await prisma.$transaction(async (tx) => {
      // 刪除相關的預約和評價
      if (user.partner) {
        // 刪除夥伴的時段
        await tx.schedule.deleteMany({
          where: { partnerId: user.partner.id }
        });
      }

      if (user.customer) {
        // 刪除顧客的預約
        await tx.booking.deleteMany({
          where: { customerId: user.customer.id }
        });
      }

      // 刪除評價
      await tx.review.deleteMany({
        where: {
          OR: [
            { reviewerId: userId },
            { revieweeId: userId }
          ]
        }
      });

      // 刪除訂單
      if (user.customer) {
        await tx.order.deleteMany({
          where: { customerId: user.customer.id }
        });
      }

      // 刪除夥伴資料
      if (user.partner) {
        await tx.partner.delete({
          where: { id: user.partner.id }
        });
      }

      // 刪除顧客資料
      if (user.customer) {
        await tx.customer.delete({
          where: { id: user.customer.id }
        });
      }

      // 最後刪除用戶
      await tx.user.delete({
        where: { id: userId }
      });
    });

    return NextResponse.json({ message: '用戶已成功刪除' });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error deleting user" }, { status: 500 });
  }
} 