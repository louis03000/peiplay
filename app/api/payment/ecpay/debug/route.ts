import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6',
  PAYMENT_URL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
  RETURN_URL: 'https://peiplay.vercel.app/api/payment/callback',
  CLIENT_BACK_URL: 'https://peiplay.vercel.app/booking',
  CLIENT_FRONT_URL: 'https://peiplay.vercel.app/booking'
}

// 產生綠界金流所需的檢查碼
function generateCheckMacValue(params: Record<string, string>): string {
  // 1. 將參數依照參數名稱 ASCII Code 編碼排序
  const sortedKeys = Object.keys(params).sort()
  
  // 2. 組合參數（不包含 CheckMacValue）
  let queryString = ''
  for (const key of sortedKeys) {
    if (key !== 'CheckMacValue' && params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  // 3. 加入 HashKey
  queryString += `HashKey=${ECPAY_CONFIG.HASH_KEY}`
  
  // 4. 進行 URL encode
  const urlEncoded = encodeURIComponent(queryString)
  
  // 5. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 6. 加入 HashIV
  const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 7. 進行 URL encode
  const finalEncoded = encodeURIComponent(withHashIV)
  
  // 8. 轉為小寫
  const finalLower = finalEncoded.toLowerCase()
  
  // 9. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(finalLower).digest('hex')
  
  // 10. 轉為大寫
  return hash.toUpperCase()
}

export async function GET() {
  try {
    // 產生測試訂單編號
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
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
      TotalAmount: '100',
      TradeDesc: '測試交易',
      ItemName: 'PeiPlay 遊戲夥伴預約 - 測試',
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
      OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
      ChoosePayment: 'Credit',
      EncryptType: '1'
    }

    // 產生檢查碼
    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    // 計算過程
    const sortedKeys = Object.keys(ecpayParams).sort()
    let queryString = ''
    for (const key of sortedKeys) {
      if (key !== 'CheckMacValue' && ecpayParams[key] !== '' && ecpayParams[key] !== null && ecpayParams[key] !== undefined) {
        queryString += `${key}=${ecpayParams[key]}&`
      }
    }
    queryString += `HashKey=${ECPAY_CONFIG.HASH_KEY}`
    
    const urlEncoded = encodeURIComponent(queryString)
    const lowerCase = urlEncoded.toLowerCase()
    const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
    const finalEncoded = encodeURIComponent(withHashIV)
    const finalLower = finalEncoded.toLowerCase()

    return NextResponse.json({
      success: true,
      config: {
        MERCHANT_ID: ECPAY_CONFIG.MERCHANT_ID,
        HASH_KEY: ECPAY_CONFIG.HASH_KEY,
        HASH_IV: ECPAY_CONFIG.HASH_IV,
        PAYMENT_URL: ECPAY_CONFIG.PAYMENT_URL
      },
      params: ecpayParams,
      calculation: {
        sortedKeys,
        queryString,
        urlEncoded,
        lowerCase,
        withHashIV,
        finalEncoded,
        finalLower,
        checkMacValue
      }
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: '調試失敗' },
      { status: 500 }
    )
  }
} 