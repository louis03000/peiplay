import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691', // 正式環境的商店ID
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6',
  PAYMENT_URL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5', // 使用正式環境
  RETURN_URL: 'https://peiplay.vercel.app/api/payment/callback',
  CLIENT_BACK_URL: 'https://peiplay.vercel.app/booking',
  CLIENT_FRONT_URL: 'https://peiplay.vercel.app/booking'
}

// 綠界特定的 URL 編碼函數（空格編碼為 +，不是 %20）
function customUrlEncode(str: string): string {
  // 使用標準的 encodeURIComponent 來正確編碼所有字符
  let result = encodeURIComponent(str)
  
  // 將編碼後的空格 %20 轉為 +（綠界要求）
  result = result.replace(/%20/g, '+')
  
  return result
}

// 完全按照綠界官方步驟的 CheckMacValue 生成函數
function generateCheckMacValue(params: Record<string, string>): string {
  // 開發期防呆：檢查是否有疑似已編碼的值
  for (const [k, v] of Object.entries(params)) {
    if (/%[0-9a-f]{2}/i.test(String(v))) {
      throw new Error(`參數 ${k} 看起來已被 URL 編碼，請改傳原始值：${v}`)
    }
  }

  // 1) 依鍵名 A-Z 排序；略過空值與 CheckMacValue 本身
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'CheckMacValue' && params[k] !== '' && params[k] != null)
    .sort((a, b) => a.localeCompare(b))

  // 2) 組合 query string（值不要預先做任何 encode）
  const query = sortedKeys.map(k => `${k}=${params[k]}`).join('&')

  // 3) 前後夾上 HashKey/HashIV
  const raw = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${query}&HashIV=${ECPAY_CONFIG.HASH_IV}`

  // 4) 一次 UrlEncode（RFC 3986 風格），轉小寫，再做 .NET(ecpay) 對應字元還原，最後把空白改成 +
  const normalized = encodeURIComponent(raw)
    .toLowerCase()
    // ── 依綠界對照表還原（有些語言才需要；在 JS 沒影響，但安全起見照做）
    .replace(/%2d/g, '-')  // -
    .replace(/%5f/g, '_')  // _
    .replace(/%2e/g, '.')  // .
    .replace(/%21/g, '!')  // !
    .replace(/%2a/g, '*')  // *
    .replace(/%28/g, '(')  // (
    .replace(/%29/g, ')')  // )
    // 空白改為 +
    .replace(/%20/g, '+')

  // 5) SHA256 → 6) 大寫
  return crypto.createHash('sha256').update(normalized).digest('hex').toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bookingId, amount, description, customerName, customerEmail } = body

    if (!bookingId || !amount || !description) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    // 產生訂單編號（格式：年月日時分秒 + 3位隨機數，限制在20字元內）
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2) // 只取年份後兩位
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    
    const orderNumber = `PEI${year}${month}${day}${hour}${minute}${second}${random}`

    // 準備綠界金流參數
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: amount.toString(),
      TradeDesc: description,
      ItemName: `PeiPlay 遊戲夥伴預約 - ${description}`,
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
      OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
      ChoosePayment: 'ALL', // 改為 ALL，支援所有付款方式
      EncryptType: '1',
      Language: 'ZH-TW',
      // 添加綠界官方推薦的必要參數
      NeedExtraPaidInfo: 'N',
      Redeem: 'N',
      UnionPay: '0',
      IgnorePayment: 'WebATM#ATM#CVS#BARCODE',
      ExpireDate: '7',
      PaymentInfoURL: ECPAY_CONFIG.RETURN_URL,
      ClientRedirectURL: ECPAY_CONFIG.CLIENT_FRONT_URL
    }

    // 產生檢查碼
    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    // 更新預約狀態為等待付款
    try {
      const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/bookings/${bookingId}/update-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PENDING_PAYMENT',
          orderNumber: orderNumber,
          expectedAmount: parseInt(amount) // 記錄預期金額
        })
      })

      if (!updateResponse.ok) {
        console.error('Failed to update booking status')
      }
    } catch (error) {
      console.error('Error updating booking status:', error)
    }

    return NextResponse.json({
      success: true,
      paymentUrl: ECPAY_CONFIG.PAYMENT_URL,
      params: ecpayParams,
      orderNumber: orderNumber
    })

  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json(
      { error: '建立付款失敗' },
      { status: 500 }
    )
  }
} 