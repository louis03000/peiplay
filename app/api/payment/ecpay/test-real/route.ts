import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定 - 與實際支付代碼相同
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6',
  RETURN_URL: 'https://peiplay.vercel.app/api/payment/callback',
  CLIENT_BACK_URL: 'https://peiplay.vercel.app/booking',
  CLIENT_FRONT_URL: 'https://peiplay.vercel.app/booking'
}

// 自定義 URLEncode 函數，使用舊版標準（空格編碼為 +）
function customUrlEncode(str: string): string {
  return str.replace(/\+/g, '%2B')
            .replace(/\s/g, '+')
            .replace(/"/g, '%22')
            .replace(/'/g, '%27')
            .replace(/</g, '%3C')
            .replace(/>/g, '%3E')
            .replace(/#/g, '%23')
            .replace(/%/g, '%25')
            .replace(/\{/g, '%7B')
            .replace(/\}/g, '%7D')
            .replace(/\|/g, '%7C')
            .replace(/\\/g, '%5C')
            .replace(/\^/g, '%5E')
            .replace(/\[/g, '%5B')
            .replace(/\]/g, '%5D')
            .replace(/`/g, '%60')
            .replace(/;/g, '%3B')
            .replace(/\//g, '%2F')
            .replace(/\?/g, '%3F')
            .replace(/:/g, '%3A')
            .replace(/@/g, '%40')
            .replace(/=/g, '%3D')
            .replace(/&/g, '%26')
            .replace(/\$/g, '%24')
            .replace(/,/g, '%2C')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/!/g, '%21')
            .replace(/~/g, '%7E')
            .replace(/\*/g, '%2A')
            // 移除對 . 和 - 的編碼，讓它們保持原樣
            // .replace(/\./g, '%2E')
            // .replace(/_/g, '%5F')
            // .replace(/-/g, '%2D')
}

// 綠界官方正確的 CheckMacValue 計算方式
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
  
  // 5. 進行 URL encode（使用舊版標準，空格編碼為 +）
  const urlEncoded = customUrlEncode(withKeys)
  
  // 6. 轉為小寫
  const lowerCase = urlEncoded.toLowerCase()
  
  // 7. 使用 SHA256 加密
  const hash = crypto.createHash('sha256').update(lowerCase).digest('hex')
  
  // 8. 轉為大寫
  return hash.toUpperCase()
}

export async function GET() {
  try {
    // 模擬實際支付參數
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    
    const orderNumber = `PEI${year}${month}${day}${hour}${minute}${second}${random}`

    // 實際支付參數
    const ecpayParams: Record<string, string> = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試交易',
      ItemName: 'PeiPlay 遊戲夥伴預約 - 測試交易',
      ReturnURL: ECPAY_CONFIG.RETURN_URL,
      ClientBackURL: ECPAY_CONFIG.CLIENT_BACK_URL,
      OrderResultURL: ECPAY_CONFIG.CLIENT_FRONT_URL,
      ChoosePayment: 'ALL',
      EncryptType: '1',
      Language: 'ZH-TW',
      NeedExtraPaidInfo: 'N',
      Redeem: 'N',
      UnionPay: '0',
      IgnorePayment: 'WebATM#ATM#CVS#BARCODE',
      ExpireDate: '7',
      PaymentInfoURL: ECPAY_CONFIG.RETURN_URL,
      ClientRedirectURL: ECPAY_CONFIG.CLIENT_FRONT_URL
    }

    // 步驟 1: 排序參數
    const sortedKeys = Object.keys(ecpayParams).sort()
    let step1 = ''
    for (const key of sortedKeys) {
      step1 += `${key}=${ecpayParams[key]}&`
    }
    step1 = step1.slice(0, -1)

    // 步驟 2: 前面加 HashKey，後面加 HashIV
    const step2 = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${step1}&HashIV=${ECPAY_CONFIG.HASH_IV}`

    // 步驟 3: URL encode
    const step3 = customUrlEncode(step2)

    // 步驟 4: 轉小寫
    const step4 = step3.toLowerCase()

    // 步驟 5: SHA256 加密
    const step5 = crypto.createHash('sha256').update(step4).digest('hex')

    // 步驟 6: 轉大寫
    const step6 = step5.toUpperCase()

    // 使用實際的 CheckMacValue 計算函數
    const actualCheckMacValue = generateCheckMacValue(ecpayParams)

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>實際支付參數測試</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; word-break: break-all; border-left: 4px solid #2196F3; }
          .success { color: #4CAF50; font-weight: bold; }
          .error { color: #f44336; font-weight: bold; }
          .header { background: #2196F3; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .param-list { background: #f9f9f9; padding: 10px; border-radius: 3px; margin: 10px 0; }
          .test-button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
          .test-button:hover { background: #45a049; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 實際支付參數測試</h1>
            <p>使用實際支付代碼的參數進行 CheckMacValue 計算測試</p>
          </div>

          <div class="step">
            <h3>📋 實際支付參數</h3>
            <div class="param-list">
              ${Object.entries(ecpayParams).map(([key, value]) => `<strong>${key}:</strong> ${value}`).join('<br>')}
            </div>
          </div>
          
          <div class="step">
            <h3>📋 步驟 1: 排序參數</h3>
            <div class="code">${step1}</div>
          </div>
          
          <div class="step">
            <h3>🔑 步驟 2: 前面加 HashKey，後面加 HashIV</h3>
            <div class="code">${step2}</div>
          </div>
          
          <div class="step">
            <h3>🌐 步驟 3: URL encode</h3>
            <div class="code">${step3}</div>
          </div>
          
          <div class="step">
            <h3>📝 步驟 4: 轉小寫</h3>
            <div class="code">${step4}</div>
          </div>
          
          <div class="step">
            <h3>🔐 步驟 5: SHA256 加密</h3>
            <div class="code">${step5}</div>
          </div>
          
          <div class="step">
            <h3>📊 步驟 6: 轉大寫</h3>
            <div class="code success">${step6}</div>
          </div>
          
          <div class="step">
            <h3>🎯 最終結果</h3>
            <p><strong>手動計算結果:</strong></p>
            <div class="code">${step6}</div>
            <p><strong>函數計算結果:</strong></p>
            <div class="code">${actualCheckMacValue}</div>
            <p><strong>是否一致:</strong> 
              <span class="${step6 === actualCheckMacValue ? 'success' : 'error'}">
                ${step6 === actualCheckMacValue ? '✅ 是' : '❌ 否'}
              </span>
            </p>
          </div>

          <div class="step">
            <h3>🧪 測試按鈕</h3>
            <button class="test-button" onclick="window.open('https://peiplay.vercel.app/api/payment/ecpay/debug-calc', '_blank')">官方範例測試</button>
            <button class="test-button" onclick="window.open('https://peiplay.vercel.app/api/payment/ecpay/test-real', '_blank')">重新測試</button>
          </div>

          <div class="step">
            <h3>⚠️ 重要說明</h3>
            <ul>
              <li>此測試使用實際支付代碼的參數</li>
              <li>包含所有實際使用的參數和設定</li>
              <li>如果計算結果不一致，表示實際支付代碼有問題</li>
              <li>如果計算結果一致但支付仍失敗，可能是其他問題</li>
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
    console.error('Test real error:', error)
    return NextResponse.json(
      { error: '測試失敗' },
      { status: 500 }
    )
  }
}
