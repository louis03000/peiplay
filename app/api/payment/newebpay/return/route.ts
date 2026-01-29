/**
 * 藍新金流 Return URL（僅顯示畫面用，不可作為付款結果依據）
 * 收到 POST 後解密 TradeInfo，依 Status 重導向至付款結果頁。
 */

import { NextRequest, NextResponse } from 'next/server';
import { decryptTradeInfo, verifyTradeSha } from '@/lib/newebpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const TradeInfoEnc = (formData.get('TradeInfo') as string) || '';
    const TradeSha = (formData.get('TradeSha') as string) || '';

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://peiplay.vercel.app';
    const successUrl = new URL('/booking/payment-success', baseUrl);
    successUrl.searchParams.set('gateway', 'newebpay');
    successUrl.searchParams.set('RtnCode', '1');
    successUrl.searchParams.set('RtnMsg', '付款成功');

    if (!TradeInfoEnc || !TradeSha) {
      const failUrl = new URL('/booking/payment-success', baseUrl);
      failUrl.searchParams.set('gateway', 'newebpay');
      failUrl.searchParams.set('RtnCode', '0');
      failUrl.searchParams.set('RtnMsg', '缺少回傳參數');
      return NextResponse.redirect(failUrl);
    }

    if (!verifyTradeSha(TradeInfoEnc, TradeSha)) {
      const failUrl = new URL('/booking/payment-success', baseUrl);
      failUrl.searchParams.set('gateway', 'newebpay');
      failUrl.searchParams.set('RtnCode', '0');
      failUrl.searchParams.set('RtnMsg', '驗證失敗');
      return NextResponse.redirect(failUrl);
    }

    let info: Record<string, string>;
    try {
      info = decryptTradeInfo(TradeInfoEnc);
    } catch {
      const failUrl = new URL('/booking/payment-success', baseUrl);
      failUrl.searchParams.set('gateway', 'newebpay');
      failUrl.searchParams.set('RtnCode', '0');
      failUrl.searchParams.set('RtnMsg', '解密失敗');
      return NextResponse.redirect(failUrl);
    }

    const Status = info.Status;
    const MerchantOrderNo = info.MerchantOrderNo || '';

    successUrl.searchParams.set('MerchantTradeNo', MerchantOrderNo);
    if (Status === 'SUCCESS') {
      return NextResponse.redirect(successUrl);
    }

    const failUrl = new URL('/booking/payment-success', baseUrl);
    failUrl.searchParams.set('gateway', 'newebpay');
    failUrl.searchParams.set('RtnCode', '0');
    failUrl.searchParams.set('RtnMsg', info.Message || '付款未完成');
    failUrl.searchParams.set('MerchantTradeNo', MerchantOrderNo);
    return NextResponse.redirect(failUrl);
  } catch (error) {
    console.error('[NewebPay Return]', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://peiplay.vercel.app';
    const failUrl = new URL('/booking/payment-success', baseUrl);
    failUrl.searchParams.set('gateway', 'newebpay');
    failUrl.searchParams.set('RtnCode', '0');
    failUrl.searchParams.set('RtnMsg', '系統錯誤');
    return NextResponse.redirect(failUrl);
  }
}
