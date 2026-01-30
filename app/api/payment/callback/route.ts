/**
 * 绿界支付回调处理 API
 * 
 * 处理支付成功/失败的回调
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCheckMacValue } from '@/lib/ecpay';
import { db } from '@/lib/db-resilience';
import { PaymentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 处理绿界支付回调（POST）
 */
export async function POST(request: NextRequest) {
  try {
    // 绿界使用 form-data 格式发送回调
    const formData = await request.formData();
    const params: Record<string, string> = {};

    // 将 formData 转换为对象
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    console.log('收到绿界支付回调:', params);

    // 验证 CheckMacValue
    if (!verifyCheckMacValue(params)) {
      console.error('CheckMacValue 验证失败');
      return NextResponse.json({ error: '驗證失敗' }, { status: 400 });
    }

    const {
      MerchantTradeNo,
      RtnCode,
      RtnMsg,
      TradeNo,
      TradeAmt,
      PaymentDate,
      PaymentType,
      PaymentTypeChargeFee,
      TradeDate,
    } = params;

    // 根据订单编号查找预约
    const booking = await db.query(async (client) => {
      return client.booking.findFirst({
        where: {
          orderNumber: MerchantTradeNo,
        },
        include: {
          customer: {
            include: {
              user: true,
            },
          },
        },
      });
    }, 'payment:find-booking');

    if (!booking) {
      console.error('找不到对应的预约:', MerchantTradeNo);
      return NextResponse.json({ error: '找不到訂單' }, { status: 404 });
    }

    // 检查支付状态
    const isSuccess = RtnCode === '1'; // 1 表示成功

    if (isSuccess) {
      // 支付成功
      console.log('支付成功:', {
        MerchantTradeNo,
        TradeNo,
        TradeAmt,
        PaymentDate,
      });

      // 创建或更新支付记录
      await db.query(async (client) => {
        // 检查是否已存在支付记录
        const existingPayment = await client.payment.findFirst({
          where: {
            bookingId: booking.id,
            providerId: TradeNo,
          },
        });

        if (existingPayment) {
          // 更新现有记录
          await client.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: PaymentStatus.SUCCEEDED,
              rawResponse: params as any,
            },
          });
        } else {
          // 创建新记录
          await client.payment.create({
            data: {
              bookingId: booking.id,
              provider: 'ECPAY',
              providerId: TradeNo,
              amountCents: Math.round(parseFloat(TradeAmt || '0') * 100), // 转换为分
              currency: 'TWD',
              status: PaymentStatus.SUCCEEDED,
              rawResponse: params as any,
              idempotencyKey: TradeNo, // 使用绿界的交易编号作为幂等键
            },
          });
        }

        // 付款成功：若為待付款／待確認，更新狀態
        const wasUnpaid = booking.status === 'PENDING_PAYMENT' || booking.status === 'PENDING';
        if (wasUnpaid) {
          // 查詢預約詳情，判斷預約類型
          const bookingDetails = await client.booking.findUnique({
            where: { id: booking.id },
            select: {
              isGroupBooking: true,
              groupBookingId: true,
              isMultiPlayerBooking: true,
              multiPlayerBookingId: true,
            },
          });

          // 根據預約類型決定目標狀態
          // 群組預約：更新為 CONFIRMED（因為群組預約不需要夥伴再次確認）
          // 多人陪玩/一般預約：更新為 PAID_WAITING_PARTNER_CONFIRMATION（需要夥伴確認）
          const targetStatus = bookingDetails?.isGroupBooking 
            ? 'CONFIRMED' 
            : 'PAID_WAITING_PARTNER_CONFIRMATION';

          await client.booking.update({
            where: { id: booking.id },
            data: { status: targetStatus },
          });

          console.log(`✅ 預約狀態已更新為 ${targetStatus}，類型：${bookingDetails?.isGroupBooking ? '群組預約' : bookingDetails?.isMultiPlayerBooking ? '多人陪玩' : '一般預約'}`);
        }

        // 僅在「本次由待付款更新為已付款」時發送通知（避免重複 callback 重發；且絕不於付款前發送）
        if (!wasUnpaid) return;

        const { sendBookingNotificationEmail, sendGroupBookingJoinNotification } = await import('@/lib/email');
        const bookingWithDetails = await client.booking.findUnique({
          where: { id: booking.id },
          include: {
            schedule: {
              include: {
                partner: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            customer: {
              include: {
                user: true,
              },
            },
            groupBooking: true,
          },
        });

        if (!bookingWithDetails) return;

        // 群組預約：發送通知給加入者和夥伴
        if (bookingWithDetails.isGroupBooking && bookingWithDetails.groupBooking) {
          const groupBooking = bookingWithDetails.groupBooking;
          
          // 發送給加入者的確認通知
          if (bookingWithDetails.customer?.user?.email) {
            sendGroupBookingJoinNotification(
              bookingWithDetails.customer.user.email,
              bookingWithDetails.customer.user.name || '您',
              groupBooking.title || '群組預約',
              {
                groupBookingId: groupBooking.id,
                title: groupBooking.title || '群組預約',
                startTime: bookingWithDetails.schedule.startTime.toISOString(),
                endTime: bookingWithDetails.schedule.endTime.toISOString(),
                pricePerPerson: bookingWithDetails.finalAmount || bookingWithDetails.originalAmount || 0,
                currentParticipants: groupBooking.currentParticipants,
                maxParticipants: groupBooking.maxParticipants,
              }
            )
              .then(() => {
                console.log('✅ 群組預約付款成功通知已發送給加入者:', bookingWithDetails.customer.user.email);
              })
              .catch((error) => {
                console.error('❌ 發送群組預約加入者通知失敗:', error);
              });
          }

          // 發送給夥伴的新訂單通知
          if (bookingWithDetails.schedule?.partner?.user?.email) {
            const duration = bookingWithDetails.schedule.endTime.getTime() - bookingWithDetails.schedule.startTime.getTime();
            const durationHours = duration / (1000 * 60 * 60);
            
            sendBookingNotificationEmail(
              bookingWithDetails.schedule.partner.user.email,
              bookingWithDetails.schedule.partner.user.name || bookingWithDetails.schedule.partner.name || '夥伴',
              bookingWithDetails.customer.user.name || '客戶',
              {
                bookingId: bookingWithDetails.id,
                startTime: bookingWithDetails.schedule.startTime.toISOString(),
                endTime: bookingWithDetails.schedule.endTime.toISOString(),
                duration: durationHours,
                totalCost: bookingWithDetails.finalAmount || bookingWithDetails.originalAmount || 0,
                customerName: bookingWithDetails.customer.user.name || '客戶',
                customerEmail: bookingWithDetails.customer.user.email,
              }
            )
              .then(() => {
                console.log('✅ 群組預約付款成功，訂單通知已發送給夥伴:', bookingWithDetails.schedule.partner.user.email);
              })
              .catch((error) => {
                console.error('❌ 發送群組預約夥伴通知失敗:', error);
              });
          }
        } else {
          // 一般預約或多人陪玩：發送給夥伴的新訂單通知
          if (bookingWithDetails?.schedule?.partner?.user?.email) {
            const duration = bookingWithDetails.schedule.endTime.getTime() - bookingWithDetails.schedule.startTime.getTime();
            const durationHours = duration / (1000 * 60 * 60);
            
            sendBookingNotificationEmail(
              bookingWithDetails.schedule.partner.user.email,
              bookingWithDetails.schedule.partner.user.name || bookingWithDetails.schedule.partner.name || '夥伴',
              bookingWithDetails.customer.user.name || '客戶',
              {
                bookingId: bookingWithDetails.id,
                startTime: bookingWithDetails.schedule.startTime.toISOString(),
                endTime: bookingWithDetails.schedule.endTime.toISOString(),
                duration: durationHours,
                totalCost: bookingWithDetails.finalAmount || bookingWithDetails.originalAmount || 0,
                customerName: bookingWithDetails.customer.user.name || '客戶',
                customerEmail: bookingWithDetails.customer.user.email,
              }
            )
              .then(() => {
                console.log('✅ 支付成功後，預約通知已發送給夥伴:', bookingWithDetails.schedule.partner.user.email);
              })
              .catch((error) => {
                console.error('❌ 發送預約通知失敗:', error);
              });
          }
        }
      }, 'payment:update-booking-status');
    } else {
      // 支付失败
      console.log('支付失败:', {
        MerchantTradeNo,
        RtnCode,
        RtnMsg,
      });

      // 创建失败记录
      await db.query(async (client) => {
        await client.payment.create({
          data: {
            bookingId: booking.id,
            provider: 'ECPAY',
            providerId: TradeNo || MerchantTradeNo,
            amountCents: Math.round(parseFloat(TradeAmt || '0') * 100),
            currency: 'TWD',
            status: PaymentStatus.FAILED,
            rawResponse: params as any,
            idempotencyKey: TradeNo || MerchantTradeNo,
          },
        });
      }, 'payment:create-failed-payment');
    }

    // 返回成功响应给绿界
    return NextResponse.json({ RtnCode: '1', RtnMsg: 'OK' });
  } catch (error) {
    console.error('处理支付回调失败:', error);
    return NextResponse.json(
      { error: '處理失敗' },
      { status: 500 }
    );
  }
}

/**
 * 处理 GET 请求（用于测试或重定向）
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const merchantTradeNo = searchParams.get('MerchantTradeNo');
  const rtnCode = searchParams.get('RtnCode');
  const rtnMsg = searchParams.get('RtnMsg');

  // 构建重定向 URL
  const redirectUrl = new URL('/booking/payment-success', request.url);
  if (rtnCode) redirectUrl.searchParams.set('RtnCode', rtnCode);
  if (rtnMsg) redirectUrl.searchParams.set('RtnMsg', rtnMsg);
  if (merchantTradeNo) redirectUrl.searchParams.set('MerchantTradeNo', merchantTradeNo);

  return NextResponse.redirect(redirectUrl);
}
