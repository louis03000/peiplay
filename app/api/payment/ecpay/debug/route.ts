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
  
  // 3. 移除最後一個 & 符號
  queryString = queryString.slice(0, -1)
  
  // 4. 加入 HashKey
  queryString += `&HashKey=${ECPAY_CONFIG.HASH_KEY}`
  
  // 5. 進行 URL encode
  const urlEncoded = encodeURIComponent(queryString)
  
  // 6. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 7. 加入 HashIV
  const withHashIV = lowerCase + `&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 8. 進行 URL encode
  const finalEncoded = encodeURIComponent(withHashIV)
  
  // 9. 轉為小寫
  const finalLower = finalEncoded.toLowerCase()
  
  // 10. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(finalLower).digest('hex')
  
  // 11. 轉為大寫
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
      EncryptType: '1',
      IgnorePayment: 'WebATM#ATM#CVS#BARCODE',
      ExpireDate: '7',
      // 添加更多必要參數
      Language: 'ZH-TW',
      NeedExtraPaidInfo: 'N',
      Redeem: 'N',
      UnionPay: 0
    }

    // 產生檢查碼
    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    // 創建詳細的調試頁面
    const debugHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界 CheckMacValue 調試</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
          .step { margin: 10px 0; padding: 10px; background: #f5f5f5; }
          .error { color: red; }
          .success { color: green; }
          pre { background: #f0f0f0; padding: 10px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>綠界 CheckMacValue 調試工具</h1>
        
        <div class="section">
          <h2>1. 原始參數</h2>
          <pre>${JSON.stringify(ecpayParams, null, 2)}</pre>
        </div>
        
        <div class="section">
          <h2>2. 參數排序</h2>
          <p>排序後的參數名稱：${Object.keys(ecpayParams).sort().join(', ')}</p>
        </div>
        
        <div class="section">
          <h2>3. 檢查碼計算步驟</h2>
          <div class="step">
            <strong>步驟 1:</strong> 組合參數（不含 CheckMacValue）
            <pre>${Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&')}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 2:</strong> 加入 HashKey
            <pre>${Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&')}&HashKey=${ECPAY_CONFIG.HASH_KEY}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 3:</strong> URL Encode
            <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`)}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 4:</strong> 轉小寫
            <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase()}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 5:</strong> 加入 HashIV
            <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase()}&HashIV=${ECPAY_CONFIG.HASH_IV}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 6:</strong> 最終 URL Encode
            <pre>${encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`)}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 7:</strong> 轉小寫
            <pre>${encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`).toLowerCase()}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 8:</strong> SHA256 加密
            <pre>${crypto.createHash('sha256').update(encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`).toLowerCase()).digest('hex')}</pre>
          </div>
          
          <div class="step">
            <strong>步驟 9:</strong> 轉大寫 (最終 CheckMacValue)
            <pre class="success">${checkMacValue}</pre>
          </div>
        </div>
        
        <div class="section">
          <h2>4. 測試表單</h2>
          <form method="POST" action="${ECPAY_CONFIG.PAYMENT_URL}" target="_blank">
            ${Object.entries(ecpayParams).map(([key, value]) => 
              `<input type="hidden" name="${key}" value="${value}">`
            ).join('')}
            <button type="submit">提交到綠界測試</button>
          </form>
        </div>
        
        <div class="section">
          <h2>5. 配置信息</h2>
          <p><strong>MerchantID:</strong> ${ECPAY_CONFIG.MERCHANT_ID}</p>
          <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY}</p>
          <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV}</p>
          <p><strong>Payment URL:</strong> ${ECPAY_CONFIG.PAYMENT_URL}</p>
        </div>
      </body>
      </html>
    `

    return new NextResponse(debugHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: '調試失敗' },
      { status: 500 }
    )
  }
} 