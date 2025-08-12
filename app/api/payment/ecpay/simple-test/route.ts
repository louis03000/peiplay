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

// 產生綠界金流所需的檢查碼（正確方式）
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
  
  // 4. 最前面加上 HashKey，最後面加上 HashIV（綠界官方正確方式）
  const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
  
  // 5. 進行 URL encode
  const urlEncoded = encodeURIComponent(withKeys)
  
  // 6. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 7. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
  
  // 8. 轉為大寫
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
    
    const orderNumber = `SIMPLE${year}${month}${day}${hour}${minute}${second}${random}`

    // 使用最簡化的參數組合
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '簡化測試',
      ItemName: 'PeiPlay 遊戲夥伴預約 - 簡化測試',
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ChoosePayment: 'Credit',
      EncryptType: '1'
    }

    // 產生檢查碼
    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    // 顯示詳細的計算步驟
    const sortedKeys = Object.keys(ecpayParams).filter(key => key !== 'CheckMacValue').sort()
    let queryString = ''
    for (const key of sortedKeys) {
      queryString += `${key}=${ecpayParams[key]}&`
    }
    queryString = queryString.slice(0, -1)
    
    const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
    const urlEncoded = encodeURIComponent(withKeys)
    const lowerCase = urlEncoded.toLowerCase()

    const simpleTestHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界簡化測試</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container { 
            max-width: 1000px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
          }
          .header h1 {
            color: #333;
            margin: 0;
            font-size: 2.5em;
          }
          .section { 
            margin: 25px 0; 
            padding: 20px; 
            border: 2px solid #e9ecef; 
            border-radius: 10px; 
            background: #f8f9fa;
          }
          .section h2 {
            color: #495057;
            margin-top: 0;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
          }
          .success { color: #28a745; font-weight: bold; }
          .error { color: #dc3545; font-weight: bold; }
          .warning { color: #ffc107; font-weight: bold; }
          .info { color: #17a2b8; font-weight: bold; }
          .step {
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .test-button {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 25px;
            font-size: 18px;
            cursor: pointer;
            margin: 10px 5px;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
          }
          .test-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          }
          pre {
            background: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.4;
            border-left: 4px solid #667eea;
          }
          .alert {
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 5px solid;
          }
          .alert-info {
            background: #d1ecf1;
            border-color: #17a2b8;
            color: #0c5460;
          }
          .alert-success {
            background: #d4edda;
            border-color: #28a745;
            color: #155724;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧪 綠界簡化測試</h1>
            <p style="color: #666; font-size: 1.2em;">使用正確的 CheckMacValue 計算方式</p>
          </div>
          
          <div class="alert alert-info">
            <strong>🎯 測試目標：</strong> 驗證修正後的 CheckMacValue 計算是否正確
          </div>
          
          <div class="section">
            <h2>📋 測試參數</h2>
            <pre>${JSON.stringify(ecpayParams, null, 2)}</pre>
          </div>
          
          <div class="section">
            <h2>🔍 CheckMacValue 計算步驟</h2>
            <div class="step">
              <strong>步驟 1:</strong> 排序後的參數（不含 CheckMacValue）
              <pre>${queryString}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 2:</strong> 加入 HashKey 和 HashIV
              <pre>${withKeys}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 3:</strong> URL Encode
              <pre>${urlEncoded}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 4:</strong> 轉小寫
              <pre>${lowerCase}</pre>
            </div>
            
            <div class="step">
              <strong>步驟 5:</strong> SHA256 加密後轉大寫
              <pre class="success">${checkMacValue}</pre>
            </div>
          </div>
          
          <div class="section">
            <h2>🚀 測試付款</h2>
            <form method="POST" action="${ECPAY_CONFIG.PAYMENT_URL}" target="_blank">
              ${Object.entries(ecpayParams).map(([key, value]) => 
                `<input type="hidden" name="${key}" value="${value}">`
              ).join('')}
              <button type="submit" class="test-button">🧪 測試簡化配置</button>
            </form>
          </div>
          
          <div class="alert alert-success">
            <strong>✅ 修正完成：</strong> 現在使用正確的 CheckMacValue 計算方式：HashKey + 參數 + HashIV → URL encode → 轉小寫 → SHA256
          </div>
        </div>
      </body>
      </html>
    `

    return new NextResponse(simpleTestHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Simple test error:', error)
    return NextResponse.json(
      { error: '簡化測試失敗' },
      { status: 500 }
    )
  }
} 