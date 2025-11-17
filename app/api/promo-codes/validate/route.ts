import { NextResponse } from "next/server";
import { db } from "@/lib/db-resilience";


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const { code, amount, partnerId } = await request.json();

    if (!code || !amount) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      // 查找優惠碼
      const promoCode = await client.promoCode.findUnique({
        where: { code: code.toUpperCase() },
        include: {
          partner: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!promoCode) {
        throw new Error('優惠碼不存在');
      }

      // 檢查是否啟用
      if (!promoCode.isActive) {
        throw new Error('優惠碼已停用');
      }

      // 如果優惠碼綁定了特定夥伴，驗證是否匹配
      if (promoCode.partnerId) {
        if (!partnerId) {
          throw new Error('此優惠碼僅限特定夥伴使用，請選擇正確的夥伴');
        }
        if (promoCode.partnerId !== partnerId) {
          throw new Error(`此優惠碼僅限用於 ${promoCode.partner?.name || '特定夥伴'}，無法用於當前選擇的夥伴`);
        }
      }

      // 檢查使用次數限制
      if (promoCode.maxUses !== -1 && promoCode.usedCount >= promoCode.maxUses) {
        throw new Error('優惠碼使用次數已達上限');
      }

      // 檢查有效期
      const now = new Date();
      if (promoCode.validFrom > now) {
        throw new Error('優惠碼尚未生效');
      }

      if (promoCode.validUntil && promoCode.validUntil < now) {
        throw new Error('優惠碼已過期');
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

      return {
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
      };
    }, 'promo-codes/validate');

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error validating promo code:", error);
    if (error instanceof NextResponse) {
      return error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Error validating promo code';
    const status = errorMessage.includes('不存在') ? 404 : 
                   errorMessage.includes('停用') || errorMessage.includes('上限') || errorMessage.includes('生效') || errorMessage.includes('過期') || errorMessage.includes('僅限') || errorMessage.includes('無法用於') ? 400 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
} 