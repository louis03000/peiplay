/**
 * 绿界支付 (ECPay) 工具函数
 * 
 * 用于生成支付表单和验证支付回调
 */

import crypto from 'crypto';

// 绿界支付配置
const ECPAY_CONFIG = {
  MerchantID: process.env.ECPAY_MERCHANT_ID || '3464691',
  HashKey: process.env.ECPAY_HASH_KEY || 'ilByxKjPNI9qpHBK',
  HashIV: process.env.ECPAY_HASH_IV || 'OTzB3pify1U9G0j6',
  // 测试环境 URL（生产环境需要替换）
  PaymentURL: process.env.ECPAY_PAYMENT_URL || 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  // 生产环境 URL（需要根据实际情况调整）
  // PaymentURL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
};

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
 * 计算绿界支付的 CheckMacValue
 * 
 * 严格按照绿界工程师提供的示例进行计算：
 * 1. 将传递参数依照第一个英文字母，由A到Z的顺序来排序
 * 2. 用 & 方式将所有参数串连
 * 3. 参数最前面加上 HashKey=，最后面加上 &HashIV=
 * 4. 将整串字串进行 URL encode
 * 5. 转为小写
 * 6. 以 sha256 方式产生杂凑值
 * 7. 再转大写产生 CheckMacValue
 */
export function calculateCheckMacValue(params: Record<string, string>): string {
  // (1) 将传递参数依照第一个英文字母，由A到Z的顺序来排序
  // 遇到第一个英文字母相同时，以第二个英文字母来比较，以此类推
  const sortedKeys = Object.keys(params).sort((a, b) => {
    // 按字母顺序比较（不区分大小写）
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const minLength = Math.min(aLower.length, bLower.length);
    
    for (let i = 0; i < minLength; i++) {
      if (aLower[i] < bLower[i]) return -1;
      if (aLower[i] > bLower[i]) return 1;
    }
    // 如果前面的字符都相同，长度短的排在前面
    return aLower.length - bLower.length;
  });

  // (2) 用 & 方式将所有参数串连
  const paramString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // (3) 参数最前面加上 HashKey=，最后面加上 &HashIV=
  const hashString = `HashKey=${ECPAY_CONFIG.HashKey}&${paramString}&HashIV=${ECPAY_CONFIG.HashIV}`;

  // (4) 将整串字串进行 URL encode
  const encodedString = encodeURIComponent(hashString);

  // (5) 转为小写
  const lowerString = encodedString.toLowerCase();

  // (6) 以 sha256 方式产生杂凑值
  const hash = crypto.createHash('sha256').update(lowerString).digest('hex');

  // (7) 再转大写产生 CheckMacValue
  return hash.toUpperCase();
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
  const paymentParams: Record<string, string> = {
    MerchantID: ECPAY_CONFIG.MerchantID,
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
