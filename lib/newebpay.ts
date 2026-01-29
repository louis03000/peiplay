/**
 * 藍新金流 NewebPay MPG 工具
 * - AES-256-CBC 加密 TradeInfo
 * - SHA256 產生 TradeSha
 * - 僅後端使用，金流資料不可信任前端
 */

import crypto from 'crypto';

const NEWEBPAY_CONFIG = {
  MerchantID: process.env.NEWEBPAY_MERCHANT_ID,
  HashKey: process.env.NEWEBPAY_HASH_KEY,
  HashIV: process.env.NEWEBPAY_HASH_IV,
  /** MPG 幕前支付 Gateway（測試：https://ccore.newebpay.com/MPG/mpg_gateway 正式：https://core.newebpay.com/MPG/mpg_gateway） */
  MPGGateway: process.env.NEWEBPAY_MPG_GATEWAY || 'https://ccore.newebpay.com/MPG/mpg_gateway',
};

if (!NEWEBPAY_CONFIG.MerchantID || !NEWEBPAY_CONFIG.HashKey || !NEWEBPAY_CONFIG.HashIV) {
  console.error('❌ 藍新金流配置不完整：NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV 必須設定');
}

/** AES-256-CBC 加密（藍新規範：key 32 字元、IV 16 字元） */
export function aesEncrypt(plainText: string, key: string, iv: string): string {
  const keyBuf = Buffer.from(key, 'utf8');
  const ivBuf = Buffer.from(iv, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, ivBuf);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/** AES-256-CBC 解密 */
export function aesDecrypt(encryptedHex: string, key: string, iv: string): string {
  const keyBuf = Buffer.from(key, 'utf8');
  const ivBuf = Buffer.from(iv, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, ivBuf);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** SHA256 雜湊後轉大寫 hex（用於 TradeSha） */
export function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex').toUpperCase();
}

/**
 * 將交易參數物件轉成 key=value& 字串（鍵依字母排序，符合常見實作）
 */
function buildQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

/**
 * 產生 MPG 表單所需之 TradeInfo、TradeSha
 * 金流資料僅在後端產生，不可信任前端
 */
export interface NewebPayMpgTradeParams {
  MerchantOrderNo: string;
  Amt: number;
  ItemDesc: string;
  ReturnURL: string;
  NotifyURL: string;
  ClientBackURL?: string;
  Email?: string;
}

export function createMpgTradeInfoAndSha(params: NewebPayMpgTradeParams): {
  MerchantID: string;
  TradeInfo: string;
  TradeSha: string;
  Version: string;
} {
  const merchantId = NEWEBPAY_CONFIG.MerchantID;
  const hashKey = NEWEBPAY_CONFIG.HashKey;
  const hashIV = NEWEBPAY_CONFIG.HashIV;

  if (!merchantId || !hashKey || !hashIV) {
    throw new Error('藍新金流配置不完整：MerchantID、HashKey、HashIV 必須設定');
  }

  const tradeParams: Record<string, string> = {
    MerchantID: merchantId,
    RespondType: 'JSON',
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    Version: '2.0',
    LangType: 'zh-tw',
    MerchantOrderNo: params.MerchantOrderNo,
    Amt: String(Math.round(params.Amt)),
    ItemDesc: params.ItemDesc,
    ReturnURL: params.ReturnURL,
    NotifyURL: params.NotifyURL,
    ...(params.ClientBackURL && { ClientBackURL: params.ClientBackURL }),
    ...(params.Email && { Email: params.Email }),
  };

  const queryString = buildQueryString(tradeParams);
  const tradeInfo = aesEncrypt(queryString, hashKey, hashIV);
  // 藍新規範：TradeSha = SHA256(HashKey + TradeInfo + HashIV) 大寫 hex
  const tradeSha = sha256Hex(hashKey + tradeInfo + hashIV);

  return {
    MerchantID: merchantId,
    TradeInfo: tradeInfo,
    TradeSha: tradeSha,
    Version: '2.0',
  };
}

/**
 * 解密 NotifyURL / ReturnURL 回傳的 TradeInfo
 */
export function decryptTradeInfo(encryptedHex: string): Record<string, string> {
  const hashKey = NEWEBPAY_CONFIG.HashKey;
  const hashIV = NEWEBPAY_CONFIG.HashIV;
  if (!hashKey || !hashIV) {
    throw new Error('藍新金流 HashKey / HashIV 未設定');
  }
  const decrypted = aesDecrypt(encryptedHex, hashKey, hashIV);
  const params: Record<string, string> = {};
  for (const pair of decrypted.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return params;
}

/**
 * 驗證回傳的 TradeSha
 */
export function verifyTradeSha(tradeInfoEncrypted: string, receivedTradeSha: string): boolean {
  const hashKey = NEWEBPAY_CONFIG.HashKey;
  const hashIV = NEWEBPAY_CONFIG.HashIV;
  if (!hashKey || !hashIV) return false;
  const expected = sha256Hex(hashKey + tradeInfoEncrypted + hashIV);
  return expected === (receivedTradeSha || '').toUpperCase();
}

export { NEWEBPAY_CONFIG };
