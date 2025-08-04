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

    // 檢查是否為管理員
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    // 獲取所有優惠碼
    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(promoCodes);
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json({ error: "Error fetching promo codes" }, { status: 500 });
  }
}

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

    const data = await request.json();
    const { code, type, value, maxUses, validFrom, validUntil, description, isActive } = data;

    if (!code || !type || !value) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 檢查優惠碼是否已存在
    const existingCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existingCode) {
      return NextResponse.json({ error: '優惠碼已存在' }, { status: 400 });
    }

    // 創建優惠碼
    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        type,
        value: parseFloat(value),
        maxUses: parseInt(maxUses) || -1,
        validFrom: new Date(validFrom),
        validUntil: validUntil ? new Date(validUntil) : null,
        description,
        isActive
      }
    });

    return NextResponse.json(promoCode);
  } catch (error) {
    console.error("Error creating promo code:", error);
    return NextResponse.json({ error: "Error creating promo code" }, { status: 500 });
  }
} 