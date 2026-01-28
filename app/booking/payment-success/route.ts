/**
 * 处理绿界支付完成后的 POST 重定向
 * 
 * 绿界支付完成后可能会直接 POST 到 /booking/payment-success
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

    console.log('[payment-success] 收到支付 POST 请求:', params);

    // 构建查询参数
    const searchParams = new URLSearchParams();
    if (params.RtnCode) searchParams.set('RtnCode', params.RtnCode);
    if (params.RtnMsg) searchParams.set('RtnMsg', params.RtnMsg);
    if (params.MerchantTradeNo) searchParams.set('MerchantTradeNo', params.MerchantTradeNo);
    if (params.TradeNo) searchParams.set('TradeNo', params.TradeNo);
    if (params.TradeAmt) searchParams.set('TradeAmt', params.TradeAmt);

    // 重定向到 GET 页面（同一个路径，但使用 GET 方法）
    const redirectUrl = new URL('/booking/payment-success', request.url);
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    console.log('[payment-success] 重定向到:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[payment-success] 处理支付 POST 请求失败:', error);
    // 即使出错也重定向到成功页面，让用户看到结果
    return NextResponse.redirect(
      new URL('/booking/payment-success?RtnCode=0&RtnMsg=處理失敗', request.url)
    );
  }
}

// 注意：在 Next.js App Router 中，如果 route.ts 存在，
// 它会拦截所有 HTTP 方法。如果我们不导出 GET，
// GET 请求会继续到 page.tsx 处理。
// 
// 所以我们只导出 POST，让 GET 请求由 page.tsx 处理
