/**
 * 创建支付订单 API
 *
 * 支援綠界（ECPay）與藍新金流（NewebPay MPG）。
 * 金流資料僅在後端產生，前端僅以 HTML form POST 導向金流頁面。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generatePaymentParams, generateMerchantTradeNo, ECPAY_CONFIG } from '@/lib/ecpay';
import { createMpgTradeInfoAndSha, NEWEBPAY_CONFIG } from '@/lib/newebpay';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PaymentProvider = 'ecpay' | 'newebpay';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, amount, description, itemName, provider = 'ecpay' } = body as {
      bookingId: string;
      amount: number;
      description?: string;
      itemName?: string;
      provider?: PaymentProvider;
    };

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: '缺少必要参数：bookingId 和 amount' },
        { status: 400 }
      );
    }

    const paymentProvider: PaymentProvider = provider === 'newebpay' ? 'newebpay' : 'ecpay';

    // 验证预约是否存在且属于当前用户
    const booking = await db.query(async (client) => {
      return client.booking.findFirst({
        where: {
          id: bookingId,
          customer: {
            userId: session.user.id,
          },
        },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
        },
      });
    }, 'payment:verify-booking');

    if (!booking) {
      return NextResponse.json(
        { error: '預約不存在或無權限' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://peiplay.vercel.app';
    const merchantTradeNo = generateMerchantTradeNo();

    if (paymentProvider === 'newebpay') {
      if (!NEWEBPAY_CONFIG.MerchantID || !NEWEBPAY_CONFIG.HashKey || !NEWEBPAY_CONFIG.HashIV) {
        return NextResponse.json(
          { error: '藍新金流尚未設定，請聯絡管理員' },
          { status: 503 }
        );
      }

      const itemDesc = itemName || description || `PeiPlay 遊戲夥伴預約 - ${booking.customer.user.name || '客戶'}`;
      const { MerchantID, TradeInfo, TradeSha, Version } = createMpgTradeInfoAndSha({
        MerchantOrderNo: merchantTradeNo,
        Amt: Math.round(amount),
        ItemDesc: itemDesc,
        ReturnURL: `${baseUrl}/api/payment/newebpay/return`,
        NotifyURL: `${baseUrl}/api/payment/newebpay/notify`,
        ClientBackURL: `${baseUrl}/booking/payment-success`,
      });

      await db.query(async (client) => {
        await client.booking.update({
          where: { id: bookingId },
          data: { orderNumber: merchantTradeNo },
        });
      }, 'payment:update-order-number').catch((err) => {
        console.error('更新訂單編號失敗:', err);
      });

      return NextResponse.json({
        paymentUrl: NEWEBPAY_CONFIG.MPGGateway,
        paymentParams: { MerchantID, TradeInfo, TradeSha, Version },
        merchantTradeNo,
      });
    }

    // 綠界 ECPay
    const now = new Date();
    const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const year = taipeiTime.getFullYear();
    const month = String(taipeiTime.getMonth() + 1).padStart(2, '0');
    const day = String(taipeiTime.getDate()).padStart(2, '0');
    const hours = String(taipeiTime.getHours()).padStart(2, '0');
    const minutes = String(taipeiTime.getMinutes()).padStart(2, '0');
    const seconds = String(taipeiTime.getSeconds()).padStart(2, '0');
    const merchantTradeDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;

    const paymentParams = generatePaymentParams({
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: merchantTradeDate,
      TotalAmount: Math.round(amount),
      TradeDesc: description || `PeiPlay 遊戲夥伴預約 - ${booking.customer.user.name || '客戶'}`,
      ItemName: itemName || `PeiPlay 遊戲夥伴預約 - ${booking.customer.user.name || '客戶'} - 1 個時段`,
      ReturnURL: `${baseUrl}/api/payment/callback`,
      ClientBackURL: `${baseUrl}/api/payment/redirect`,
      OrderResultURL: `${baseUrl}/api/payment/redirect`,
      PaymentInfoURL: `${baseUrl}/api/payment/callback`,
      ClientRedirectURL: `${baseUrl}/booking/payment-success`,
    });

    await db.query(async (client) => {
      await client.booking.update({
        where: { id: bookingId },
        data: { orderNumber: merchantTradeNo },
      });
    }, 'payment:update-order-number').catch((error) => {
      console.error('更新订单编号失败:', error);
    });

    return NextResponse.json({
      paymentParams,
      paymentUrl: process.env.ECPAY_PAYMENT_URL || ECPAY_CONFIG.PaymentURL,
      merchantTradeNo,
    });
  } catch (error) {
    console.error('创建支付订单失败:', error);
    return NextResponse.json(
      { error: '创建支付订单失败' },
      { status: 500 }
    );
  }
}
