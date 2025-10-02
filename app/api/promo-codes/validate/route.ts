import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const { code, amount } = await request.json();

    if (!code || !amount) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 查找優惠碼
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!promoCode) {
      return NextResponse.json({ error: '優惠碼不存在' }, { status: 404 });
    }

    // 檢查是否啟用
    if (!promoCode.isActive) {
      return NextResponse.json({ error: '優惠碼已停用' }, { status: 400 });
    }

    // 檢查使用次數限制
    if (promoCode.maxUses !== -1 && promoCode.usedCount >= promoCode.maxUses) {
      return NextResponse.json({ error: '優惠碼使用次數已達上限' }, { status: 400 });
    }

    // 檢查有效期
    const now = new Date();
    if (promoCode.validFrom > now) {
      return NextResponse.json({ error: '優惠碼尚未生效' }, { status: 400 });
    }

    if (promoCode.validUntil && promoCode.validUntil < now) {
      return NextResponse.json({ error: '優惠碼已過期' }, { status: 400 });
    }

    // 計算折扣金額
    let discountAmount = 0;
    let finalAmount = amount;

    if (promoCode.type === 'PERCENTAGE') {
      discountAmount = (amount * promoCode.value) / 100;
      finalAmount = amount - discountAmount;
    } else if (promoCode.type === 'FIXED') {
      discountAmount = Math.min(promoCode.value, amount);
      finalAmount = amount - discountAmount;
    }

    return NextResponse.json({
      success: true,
      promoCode: {
        code: promoCode.code,
        type: promoCode.type,
        value: promoCode.value,
        description: promoCode.description
      },
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      originalAmount: amount
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    return NextResponse.json({ error: "Error validating promo code" }, { status: 500 });
  }
} 