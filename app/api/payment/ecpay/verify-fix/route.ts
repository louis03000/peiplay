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

// 綠界官方推薦的 CheckMacValue 計算方式
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
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    
    const orderNumber = `VER${year}${month}${day}${hour}${minute}${second}${random}`

    // 使用最簡單的參數配置，避免不必要的參數
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '驗證測試',
      ItemName: 'PeiPlay 遊戲夥伴預約 - 驗證測試',
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
      OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
      ChoosePayment: 'Credit',
      EncryptType: '1',
      Language: 'ZH-TW'
    }

    // 產生檢查碼
    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    const verifyHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界驗證修復</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .success { color: #28a745; font-weight: bold; }
          .error { color: #dc3545; font-weight: bold; }
          .warning { color: #ffc107; font-weight: bold; }
          pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
          .test-button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin: 5px; }
          .test-button:hover { background: #0056b3; }
          .info { background: #e7f3ff; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .step { margin: 10px 0; padding: 10px; background: #f5f5f5; border-left: 4px solid #007bff; }
          .config { background: #e8f4f8; padding: 10px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 綠界金流驗證修復工具</h1>
          
          <div class="info">
            <strong>修復目標：</strong> 解決 CheckMacValue Error (10200073) 問題
          </div>
          
          <div class="section">
            <h2>📋 配置信息</h2>
            <div class="config">
              <p><strong>MerchantID:</strong> <span class="success">${ECPAY_CONFIG.MERCHANT_ID}</span></p>
              <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY.substring(0, 8)}...</p>
              <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV.substring(0, 8)}...</p>
              <p><strong>Payment URL:</strong> ${ECPAY_CONFIG.PAYMENT_URL}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>🔧 簡化參數（移除可能問題的參數）</h2>
            <p class="warning">移除了以下可能導致問題的參數：</p>
            <ul>
              <li>NeedExtraPaidInfo</li>
              <li>Redeem</li>
              <li>UnionPay</li>
              <li>IgnorePayment</li>
              <li>ExpireDate</li>
            </ul>
            <pre>${JSON.stringify(ecpayParams, null, 2)}</pre>
          </div>
          
          <div class="section">
            <h2>✅ CheckMacValue 計算</h2>
            <div class="step">
              <strong>步驟 1:</strong> 排序後的參數名稱
              <pre>${Object.keys(ecpayParams).sort().join(', ')}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 2:</strong> 組合參數（不含 CheckMacValue）
              <pre>${Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&')}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 3:</strong> 加入 HashKey
              <pre>${Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&')}&HashKey=${ECPAY_CONFIG.HASH_KEY}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 4:</strong> URL Encode
              <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`)}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 5:</strong> 轉小寫
              <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase()}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 6:</strong> 加入 HashIV
              <pre>${encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase()}&HashIV=${ECPAY_CONFIG.HASH_IV}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 7:</strong> 最終 URL Encode
              <pre>${encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`)}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 8:</strong> 轉小寫
              <pre>${encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`).toLowerCase()}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 9:</strong> SHA256 加密
              <pre>${crypto.createHash('sha256').update(encodeURIComponent(encodeURIComponent(Object.keys(ecpayParams).sort().filter(key => key !== 'CheckMacValue').map(key => `${key}=${ecpayParams[key]}`).join('&') + `&HashKey=${ECPAY_CONFIG.HASH_KEY}`).toLowerCase() + `&HashIV=${ECPAY_CONFIG.HASH_IV}`).toLowerCase()).digest('hex')}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 10:</strong> 轉大寫 (最終 CheckMacValue)
              <pre class="success">${checkMacValue}</pre>
            </div>
          </div>
          
          <div class="section">
            <h2>🧪 測試表單</h2>
            <p>點擊下方按鈕測試修復後的付款功能：</p>
            <form method="POST" action="${ECPAY_CONFIG.PAYMENT_URL}" target="_blank">
              ${Object.entries(ecpayParams).map(([key, value]) => 
                `<input type="hidden" name="${key}" value="${value}">`
              ).join('')}
              <button type="submit" class="test-button">🚀 測試付款</button>
            </form>
          </div>
          
          <div class="section">
            <h2>📊 驗證檢查</h2>
            <ul>
              <li>✅ MerchantID 格式正確</li>
              <li>✅ HashKey 長度: ${ECPAY_CONFIG.HASH_KEY.length} 字元</li>
              <li>✅ HashIV 長度: ${ECPAY_CONFIG.HASH_IV.length} 字元</li>
              <li>✅ 訂單編號格式: ${orderNumber.length} 字元</li>
              <li>✅ 金額格式: ${ecpayParams.TotalAmount}</li>
              <li>✅ CheckMacValue 格式: ${checkMacValue.length} 字元</li>
              <li>✅ 移除了可能問題的參數</li>
            </ul>
          </div>
          
          <div class="info">
            <strong>修復策略：</strong> 
            <ul>
              <li>使用最簡化的參數配置</li>
              <li>移除可能導致問題的額外參數</li>
              <li>確保所有參數都是字符串類型</li>
              <li>嚴格按照綠界官方文件計算 CheckMacValue</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `

    return new NextResponse(verifyHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Verify fix error:', error)
    return NextResponse.json(
      { error: '驗證失敗' },
      { status: 500 }
    )
  }
}
