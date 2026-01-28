/**
 * 绿界支付 (ECPay) 工具函数
 * 
 * 用于生成支付表单和验证支付回调
 */

import crypto from 'crypto';

// 绿界支付配置
// ⚠️ 重要：正式商店必须使用正式环境配置，不能混用测试和正式
const ECPAY_CONFIG = {
  MerchantID: process.env.ECPAY_MERCHANT_ID,
  HashKey: process.env.ECPAY_HASH_KEY, // 不使用 fallback，必须从环境变量读取
  HashIV: process.env.ECPAY_HASH_IV, // 不使用 fallback，必须从环境变量读取
  // 根据环境选择正确的 URL
  // 正式环境：https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5
  // 测试环境：https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5
  PaymentURL: process.env.ECPAY_PAYMENT_URL || 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
};

// 验证配置完整性
if (!ECPAY_CONFIG.MerchantID || !ECPAY_CONFIG.HashKey || !ECPAY_CONFIG.HashIV) {
  console.error('❌ 绿界支付配置不完整：MerchantID、HashKey、HashIV 必须全部设置');
}

/**
 * 绿界官方 urlencode 实现（实战不会错版本）
 * 
 * 关键：使用 encodeURIComponent 然后替换特定字符
 * - %20 → +（空白字符）
 * - ! → %21
 * - * → %2A
 * - ( → %28
 * - ) → %29
 */
function ecpayUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * 计算绿界支付的 CheckMacValue
 * 
 * 步骤：
 * 1. 将参数按字母顺序排序
 * 2. 用 & 连接所有参数
 * 3. 前面加上 HashKey，后面加上 HashIV
 * 4. URL encode
 * 5. 转小写
 * 6. SHA256 哈希
 * 7. 转大写
 */
/**
 * 计算绿界支付的 CheckMacValue（绿界官方实战不会错版本）
 * 
 * 关键点：
 * 1. 必须过滤掉 CheckMacValue 本身
 * 2. 使用环境变量，不要用 fallback 测试值
 * 3. 使用正确的 urlencode 实现
 */
export function calculateCheckMacValue(params: Record<string, string>): string {
  // 过滤掉 CheckMacValue，避免循环计算
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort();

  // 用 & 方式将所有参数串连
  const paramString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // 参数最前面加上 HashKey=，最后面加上 &HashIV=
  // ⚠️ 重要：使用环境变量，不要用 fallback 测试值
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;
  
  if (!hashKey || !hashIV) {
    throw new Error('ECPAY_HASH_KEY 和 ECPAY_HASH_IV 环境变量必须设置，不能使用 fallback 测试值');
  }

  const hashString =
    `HashKey=${hashKey}&` +
    paramString +
    `&HashIV=${hashIV}`;

  // URL encode 然后转小写
  const encoded = ecpayUrlEncode(hashString).toLowerCase();

  // SHA256 哈希然后转大写
  return crypto
    .createHash('sha256')
    .update(encoded)
    .digest('hex')
    .toUpperCase();
}

/**
 * 生成支付参数
 */
export interface PaymentParams {
  MerchantTradeNo: string; // 订单编号
  MerchantTradeDate: string; // 订单时间 (格式: YYYY/MM/DD HH:mm:ss)
  TotalAmount: number; // 总金额
  TradeDesc: string; // 交易描述
  ItemName: string; // 商品名称
  ReturnURL: string; // 服务器端回调 URL
  ClientBackURL: string; // 客户端返回 URL
  OrderResultURL: string; // 订单结果返回 URL
  PaymentInfoURL?: string; // 付款信息回调 URL
  ClientRedirectURL?: string; // 客户端重定向 URL
}

/**
 * 生成完整的支付参数（包含 CheckMacValue）
 */
export function generatePaymentParams(params: PaymentParams): Record<string, string> {
  // 验证配置
  if (!ECPAY_CONFIG.MerchantID || !ECPAY_CONFIG.HashKey || !ECPAY_CONFIG.HashIV) {
    throw new Error('绿界支付配置不完整：MerchantID、HashKey、HashIV 必须全部设置环境变量');
  }

  const paymentParams: Record<string, string> = {
    MerchantID: ECPAY_CONFIG.MerchantID!, // 已验证不为 undefined
    MerchantTradeNo: params.MerchantTradeNo,
    MerchantTradeDate: params.MerchantTradeDate,
    PaymentType: 'aio',
    TotalAmount: params.TotalAmount.toString(),
    TradeDesc: params.TradeDesc,
    ItemName: params.ItemName,
    ReturnURL: params.ReturnURL,
    ClientBackURL: params.ClientBackURL,
    OrderResultURL: params.OrderResultURL,
    ChoosePayment: 'ALL', // 按照工程师示例使用 ALL
    EncryptType: '1',
    Language: 'ZH-TW',
    NeedExtraPaidInfo: 'N',
    Redeem: 'N',
    UnionPay: '0',
    IgnorePayment: 'WebATM#ATM#CVS#BARCODE', // 按照工程师示例包含此参数
    ExpireDate: '7', // 7天过期
  };

  // 可选参数
  if (params.PaymentInfoURL) {
    paymentParams.PaymentInfoURL = params.PaymentInfoURL;
  }
  if (params.ClientRedirectURL) {
    paymentParams.ClientRedirectURL = params.ClientRedirectURL;
  }

  // 计算并添加 CheckMacValue
  paymentParams.CheckMacValue = calculateCheckMacValue(paymentParams);

  // 调试日志：输出完整的支付参数（用于排查问题）
  console.log('[ECPay] 生成的支付参数:', {
    MerchantID: paymentParams.MerchantID,
    ChoosePayment: paymentParams.ChoosePayment,
    TotalAmount: paymentParams.TotalAmount,
    MerchantTradeNo: paymentParams.MerchantTradeNo,
    HasIgnorePayment: 'IgnorePayment' in paymentParams,
    AllKeys: Object.keys(paymentParams).sort(),
  });

  return paymentParams;
}

/**
 * 验证回调的 CheckMacValue
 */
export function verifyCheckMacValue(params: Record<string, string>): boolean {
  const receivedCheckMacValue = params.CheckMacValue;
  if (!receivedCheckMacValue) {
    return false;
  }

  // 移除 CheckMacValue 后计算
  const paramsWithoutCheckMac = { ...params };
  delete paramsWithoutCheckMac.CheckMacValue;

  const calculatedCheckMacValue = calculateCheckMacValue(paramsWithoutCheckMac);

  return receivedCheckMacValue.toUpperCase() === calculatedCheckMacValue.toUpperCase();
}

/**
 * 生成订单编号
 * 格式: PEI + YYMMDD + HHmmss + 随机3位数字
 */
export function generateMerchantTradeNo(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `PEI${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

export { ECPAY_CONFIG };
