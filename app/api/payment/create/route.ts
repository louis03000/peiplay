/**
 * 创建支付订单 API
 * 
 * 用于生成绿界支付表单参数
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generatePaymentParams, generateMerchantTradeNo, ECPAY_CONFIG } from '@/lib/ecpay';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, amount, description, itemName } = body;

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: '缺少必要参数：bookingId 和 amount' },
        { status: 400 }
      );
    }

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

    // 生成订单编号
    const merchantTradeNo = generateMerchantTradeNo();

    // 生成订单时间（台湾时区）
    // 绿界要求格式: YYYY/MM/DD HH:mm:ss
    const now = new Date();
    const taipeiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const year = taipeiTime.getFullYear();
    const month = String(taipeiTime.getMonth() + 1).padStart(2, '0');
    const day = String(taipeiTime.getDate()).padStart(2, '0');
    const hours = String(taipeiTime.getHours()).padStart(2, '0');
    const minutes = String(taipeiTime.getMinutes()).padStart(2, '0');
    const seconds = String(taipeiTime.getSeconds()).padStart(2, '0');
    const merchantTradeDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;

    // 构建支付参数
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://peiplay.vercel.app';
    const paymentParams = generatePaymentParams({
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: merchantTradeDate,
      TotalAmount: Math.round(amount), // 绿界要求整数
      TradeDesc: description || `PeiPlay 遊戲夥伴預約 - ${booking.customer.user.name || '客戶'}`,
      ItemName: itemName || `PeiPlay 遊戲夥伴預約 - ${booking.customer.user.name || '客戶'} - 1 個時段`,
      ReturnURL: `${baseUrl}/api/payment/callback`,
      ClientBackURL: `${baseUrl}/booking`,
      OrderResultURL: `${baseUrl}/booking`,
      PaymentInfoURL: `${baseUrl}/api/payment/callback`,
      ClientRedirectURL: `${baseUrl}/booking`,
    });

    // 保存订单编号到预约记录（可选，用于追踪）
    await db.query(async (client) => {
      await client.booking.update({
        where: { id: bookingId },
        data: {
          orderNumber: merchantTradeNo,
        },
      });
    }, 'payment:update-order-number').catch((error) => {
      console.error('更新订单编号失败:', error);
      // 不阻塞支付流程
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
