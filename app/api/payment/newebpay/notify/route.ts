/**
 * 藍新金流 Notify URL（Server to Server）
 * 為唯一可信的付款結果來源，需解密 TradeInfo、驗證 TradeSha、檢查未重複處理後更新訂單。
 */

import { NextRequest, NextResponse } from 'next/server';
import { decryptTradeInfo, verifyTradeSha } from '@/lib/newebpay';
import { db } from '@/lib/db-resilience';
import { PaymentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const MerchantID = (formData.get('MerchantID') as string) || '';
    const TradeInfoEnc = (formData.get('TradeInfo') as string) || '';
    const TradeSha = (formData.get('TradeSha') as string) || '';

    if (!TradeInfoEnc || !TradeSha) {
      console.error('[NewebPay Notify] 缺少 TradeInfo 或 TradeSha');
      return new NextResponse('0|缺少參數', { status: 400 });
    }

    if (!verifyTradeSha(TradeInfoEnc, TradeSha)) {
      console.error('[NewebPay Notify] TradeSha 驗證失敗');
      return new NextResponse('0|驗證失敗', { status: 400 });
    }

    let info: Record<string, string>;
    try {
      info = decryptTradeInfo(TradeInfoEnc);
    } catch (e) {
      console.error('[NewebPay Notify] 解密 TradeInfo 失敗', e);
      return new NextResponse('0|解密失敗', { status: 400 });
    }

    const Status = info.Status;
    const MerchantOrderNo = info.MerchantOrderNo;
    const Amt = info.Amt;
    const TradeNo = info.TradeNo || '';

    console.log('[NewebPay Notify]', { Status, MerchantOrderNo, Amt, TradeNo });

    if (Status !== 'SUCCESS') {
      return new NextResponse('1|OK');
    }

    const booking = await db.query(async (client) => {
      return client.booking.findFirst({
        where: { orderNumber: MerchantOrderNo },
        include: {
          customer: { include: { user: true } },
          schedule: {
            include: {
              partner: { include: { user: true } },
            },
          },
        },
      });
    }, 'payment:newebpay-find-booking');

    if (!booking) {
      console.error('[NewebPay Notify] 找不到訂單:', MerchantOrderNo);
      return new NextResponse('1|OK');
    }

    await db.query(async (client) => {
      const existing = await client.payment.findFirst({
        where: {
          bookingId: booking.id,
          idempotencyKey: TradeNo || MerchantOrderNo,
        },
      });

      if (existing) {
        return;
      }

      await client.payment.create({
        data: {
          bookingId: booking.id,
          provider: 'NEWEBPAY',
          providerId: TradeNo || MerchantOrderNo,
          amountCents: Math.round(parseFloat(Amt || '0') * 100),
          currency: 'TWD',
          status: PaymentStatus.SUCCEEDED,
          rawResponse: info as any,
          idempotencyKey: TradeNo || MerchantOrderNo,
        },
      });

      const wasUnpaid =
        booking.status === 'PENDING_PAYMENT' || booking.status === 'PENDING';
      if (wasUnpaid) {
        await client.booking.update({
          where: { id: booking.id },
          data: { status: 'PAID_WAITING_PARTNER_CONFIRMATION' },
        });
      }

      if (!wasUnpaid) return;

      const { sendBookingNotificationEmail } = await import('@/lib/email');
      const bookingWithDetails = await client.booking.findUnique({
        where: { id: booking.id },
        include: {
          schedule: {
            include: {
              partner: { include: { user: true } },
            },
          },
          customer: { include: { user: true } },
        },
      });

      if (bookingWithDetails?.schedule?.partner?.user?.email) {
        const duration =
          bookingWithDetails.schedule.endTime.getTime() -
          bookingWithDetails.schedule.startTime.getTime();
        const durationHours = duration / (1000 * 60 * 60);
        sendBookingNotificationEmail(
          bookingWithDetails.schedule.partner.user.email,
          bookingWithDetails.schedule.partner.user.name ||
            bookingWithDetails.schedule.partner.name ||
            '夥伴',
          bookingWithDetails.customer.user.name || '客戶',
          {
            bookingId: bookingWithDetails.id,
            startTime: bookingWithDetails.schedule.startTime.toISOString(),
            endTime: bookingWithDetails.schedule.endTime.toISOString(),
            duration: durationHours,
            totalCost:
              bookingWithDetails.finalAmount ||
              bookingWithDetails.originalAmount ||
              0,
            customerName:
              bookingWithDetails.customer.user.name || '客戶',
            customerEmail: bookingWithDetails.customer.user.email,
          }
        ).catch((err) => console.error('發送預約通知失敗:', err));
      }
    }, 'payment:newebpay-update');

    return new NextResponse('1|OK');
  } catch (error) {
    console.error('[NewebPay Notify] 處理失敗', error);
    return new NextResponse('0|系統錯誤', { status: 500 });
  }
}
