import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6',
  PAYMENT_URL: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
}

// 簡化的 CheckMacValue 計算
function generateCheckMacValue(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  let queryString = ''
  
  for (const key of sortedKeys) {
    if (key !== 'CheckMacValue' && params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  queryString = queryString.slice(0, -1)
  queryString += `&HashKey=${ECPAY_CONFIG.HASH_KEY}`
  const urlEncoded = encodeURIComponent(queryString)
  const lowerCase = urlEncoded.toLowerCase()
  const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
  const finalEncoded = encodeURIComponent(withHashIV)
  const finalLower = finalEncoded.toLowerCase()
  const hash = crypto.createHash('sha256').update(finalLower).digest('hex')
  
  return hash.toUpperCase()
}

export async function GET() {
  try {
    const now = new Date()
    const orderNumber = `TEST${Date.now()}`
    
    // 最簡單的參數配置
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試',
      ItemName: '測試商品',
      ReturnURL: 'https://peiplay.vercel.app/api/payment/callback',
      ClientBackURL: 'https://peiplay.vercel.app/booking',
      OrderResultURL: 'https://peiplay.vercel.app/booking',
      ChoosePayment: 'Credit',
      EncryptType: '1'
    }

    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    const formHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界簡單測試</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .info { background: #f0f0f0; padding: 15px; margin: 10px 0; }
          pre { background: #e8f4f8; padding: 10px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>綠界簡單測試</h1>
        
        <div class="info">
          <h3>配置信息</h3>
          <p><strong>MerchantID:</strong> ${ECPAY_CONFIG.MERCHANT_ID}</p>
          <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY}</p>
          <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV}</p>
        </div>
        
        <div class="info">
          <h3>參數</h3>
          <pre>${JSON.stringify(ecpayParams, null, 2)}</pre>
        </div>
        
        <div class="info">
          <h3>CheckMacValue</h3>
          <pre>${checkMacValue}</pre>
        </div>
        
        <form method="POST" action="${ECPAY_CONFIG.PAYMENT_URL}" target="_blank">
          ${Object.entries(ecpayParams).map(([key, value]) => 
            `<input type="hidden" name="${key}" value="${value}">`
          ).join('')}
          <button type="submit" style="padding: 10px 20px; font-size: 16px;">提交到綠界</button>
        </form>
      </body>
      </html>
    `

    return new NextResponse(formHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Simple test error:', error)
    return NextResponse.json(
      { error: '測試失敗' },
      { status: 500 }
    )
  }
} 