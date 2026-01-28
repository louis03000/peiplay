/**
 * 处理绿界支付完成后的 POST 重定向
 * 
 * 绿界支付完成后会 POST 到 OrderResultURL 和 ClientBackURL
 * 这个路由接收 POST 请求，然后重定向到 GET 页面
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 获取 POST 数据（form-data）
    const formData = await request.formData();
    const params: Record<string, string> = {};

    // 将 formData 转换为对象
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    console.log('收到支付重定向请求:', params);

    // 构建查询参数
    const searchParams = new URLSearchParams();
    if (params.RtnCode) searchParams.set('RtnCode', params.RtnCode);
    if (params.RtnMsg) searchParams.set('RtnMsg', params.RtnMsg);
    if (params.MerchantTradeNo) searchParams.set('MerchantTradeNo', params.MerchantTradeNo);
    if (params.TradeNo) searchParams.set('TradeNo', params.TradeNo);
    if (params.TradeAmt) searchParams.set('TradeAmt', params.TradeAmt);

    // 重定向到支付成功页面
    const redirectUrl = new URL('/booking/payment-success', request.url);
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('处理支付重定向失败:', error);
    // 即使出错也重定向到成功页面，让用户看到结果
    return NextResponse.redirect(
      new URL('/booking/payment-success?RtnCode=0&RtnMsg=處理失敗', request.url)
    );
  }
}

/**
 * 处理 GET 请求（直接访问时重定向）
 */
export async function GET(request: NextRequest) {
  // 如果是 GET 请求，重定向到支付成功页面
  return NextResponse.redirect(new URL('/booking/payment-success', request.url));
}
