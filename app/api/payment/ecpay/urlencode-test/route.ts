import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6'
}

// 使用綠界官方範例參數
function generateCheckMacValue(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  let queryString = ''
  
  for (const key of sortedKeys) {
    if (key !== 'CheckMacValue' && params[key] !== '' && params[key] !== null && params[key] !== undefined) {
      queryString += `${key}=${params[key]}&`
    }
  }
  
  queryString = queryString.slice(0, -1)
  const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
  const urlEncoded = encodeURIComponent(withKeys)
  const lowerCase = urlEncoded.toLowerCase()
  const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
  
  return hash.toUpperCase()
}

export async function GET() {
  try {
    // 使用綠界官方範例參數
    const ecpayParams: Record<string, string> = {
      ChoosePayment: 'ALL',
      EncryptType: '1',
      ItemName: 'Apple iphone 15',
      MerchantID: '3002607',
      MerchantTradeDate: '2023/03/12 15:30:23',
      MerchantTradeNo: 'ecpay20230312153023',
      PaymentType: 'aio',
      ReturnURL: 'https://www.ecpay.com.tw/receive.php',
      TotalAmount: '30000',
      TradeDesc: '促銷方案'
    }

    const checkMacValue = generateCheckMacValue(ecpayParams)
    ecpayParams.CheckMacValue = checkMacValue

    const sortedKeys = Object.keys(ecpayParams).filter(key => key !== 'CheckMacValue').sort()
    let queryString = ''
    for (const key of sortedKeys) {
      queryString += `${key}=${ecpayParams[key]}&`
    }
    queryString = queryString.slice(0, -1)
    
    const withKeys = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${queryString}&HashIV=${ECPAY_CONFIG.HASH_IV}`
    const urlEncoded = encodeURIComponent(withKeys)
    const lowerCase = urlEncoded.toLowerCase()

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界 URLEncode 測試</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .step { margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #4CAF50; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; }
          .success { color: #4CAF50; font-weight: bold; }
          .error { color: #f44336; font-weight: bold; }
          .warning { color: #ff9800; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 綠界 URLEncode 測試</h1>
            <p>使用綠界官方範例參數驗證 CheckMacValue 計算</p>
          </div>
          
          <div class="section">
            <h2>📋 綠界官方範例參數</h2>
            <div class="code">${JSON.stringify(ecpayParams, null, 2)}</div>
          </div>
          
          <div class="section">
            <h2>🔍 CheckMacValue 計算步驟</h2>
            
            <div class="step">
              <strong>步驟 1:</strong> 排序後的參數（不含 CheckMacValue）
              <div class="code">${queryString}</div>
            </div>
            
            <div class="step">
              <strong>步驟 2:</strong> 加入 HashKey 和 HashIV
              <div class="code">${withKeys}</div>
            </div>
            
            <div class="step">
              <strong>步驟 3:</strong> URL Encode
              <div class="code">${urlEncoded}</div>
            </div>
            
            <div class="step">
              <strong>步驟 4:</strong> 轉小寫
              <div class="code">${lowerCase}</div>
            </div>
            
            <div class="step">
              <strong>步驟 5:</strong> SHA256 加密後轉大寫
              <div class="code success">${checkMacValue}</div>
            </div>
          </div>
          
          <div class="section">
            <h2>🎯 綠界官方預期結果</h2>
            <div class="code">6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840</div>
          </div>
          
          <div class="section">
            <h2>✅ 比對結果</h2>
            <div class="step">
              <strong>我們計算的結果:</strong> <span class="success">${checkMacValue}</span>
            </div>
            <div class="step">
              <strong>綠界官方預期:</strong> <span class="success">6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840</span>
            </div>
            <div class="step">
              <strong>比對結果:</strong> 
              <span class="${checkMacValue === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? 'success' : 'error'}">
                ${checkMacValue === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840' ? '✅ 完全一致！' : '❌ 不一致！'}
              </span>
            </div>
          </div>
          
          <div class="section">
            <h2>🚀 測試實際付款</h2>
            <form method="POST" action="https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5" target="_blank">
              ${Object.entries(ecpayParams).map(([key, value]) => 
                `<input type="hidden" name="${key}" value="${value}">`
              ).join('')}
              <button type="submit" style="background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                🧪 測試官方範例付款
              </button>
            </form>
          </div>
          
          <div class="section">
            <h2>💡 重要說明</h2>
            <ul>
              <li>此測試使用綠界官方範例參數</li>
              <li>如果比對結果一致，表示我們的 CheckMacValue 計算正確</li>
              <li>如果比對結果不一致，表示我們的計算邏輯有問題</li>
              <li>實際付款測試可以驗證整個流程是否正常</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('URLEncode test error:', error)
    return NextResponse.json(
      { error: 'URLEncode 測試失敗' },
      { status: 500 }
    )
  }
}
