import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const ECPAY_CONFIG = {
  MERCHANT_ID: '3002607',
  HASH_KEY: 'pwFHCqoQZGmho4w6',
  HASH_IV: 'EkRm7iFT261dpevs'
}

// 修正的 URLEncode 函數 - 只編碼真正需要編碼的字符
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

export async function GET() {
  try {
    // 使用綠界官方文檔的確切範例參數
    const params = {
      ChoosePayment: 'ALL',
      EncryptType: '1',
      ItemName: 'myItem',
      MerchantID: '3002607',
      MerchantTradeDate: '2025/02/08 09:27:23',
      MerchantTradeNo: 'ECPay1738978043',
      PaymentType: 'aio',
      ReturnURL: 'https://08f6-211-23-76-78.ngrok-free.app/returnurl.php',
      TotalAmount: '30',
      TradeDesc: 'Trade'
    }

    // 步驟 1: 排序參數
    const sortedKeys = Object.keys(params).sort()
    let step1 = ''
    for (const key of sortedKeys) {
      step1 += `${key}=${(params as any)[key]}&`
    }
    step1 = step1.slice(0, -1)

    // 步驟 2: 前面加 HashKey，後面加 HashIV
    const step2 = `HashKey=${ECPAY_CONFIG.HASH_KEY}&${step1}&HashIV=${ECPAY_CONFIG.HASH_IV}`

    // 步驟 3: URL encode (修正版本)
    const step3 = customUrlEncode(step2)

    // 步驟 4: 轉小寫
    const step4 = step3.toLowerCase()

    // 步驟 5: SHA256 加密
    const step5 = crypto.createHash('sha256').update(step4).digest('hex')

    // 步驟 6: 轉大寫
    const step6 = step5.toUpperCase()

    // 綠界官方預期的 CheckMacValue
    const expectedCheckMacValue = 'F1FB466ED0D6713DAC7158AB6705914E37C93BD44FB8FA44C17F80CD17BB5728'

    // 綠界官方文檔中的確切步驟結果
    const officialStep1 = 'ChoosePayment=ALL&EncryptType=1&ItemName=myItem&MerchantID=3002607&MerchantTradeDate=2025/02/08 09:27:23&MerchantTradeNo=ECPay1738978043&PaymentType=aio&ReturnURL=https://08f6-211-23-76-78.ngrok-free.app/returnurl.php&TotalAmount=30&TradeDesc=Trade'
    const officialStep2 = 'HashKey=pwFHCqoQZGmho4w6&ChoosePayment=ALL&EncryptType=1&ItemName=myItem&MerchantID=3002607&MerchantTradeDate=2025/02/08 09:27:23&MerchantTradeNo=ECPay1738978043&PaymentType=aio&ReturnURL=https://08f6-211-23-76-78.ngrok-free.app/returnurl.php&TotalAmount=30&TradeDesc=Trade&HashIV=EkRm7iFT261dpevs'
    const officialStep3 = 'HashKey%3DpwFHCqoQZGmho4w6%26ChoosePayment%3DALL%26EncryptType%3D1%26ItemName%3DmyItem%26MerchantID%3D3002607%26MerchantTradeDate%3D2025%2F02%2F08+09%3A27%3A23%26MerchantTradeNo%3DECPay1738978043%26PaymentType%3Daio%26ReturnURL%3Dhttps%3A%2F%2F08f6-211-23-76-78.ngrok-free.app%2Freturnurl.php%26TotalAmount%3D30%26TradeDesc%3DTrade%26HashIV%3DEkRm7iFT261dpevs'
    const officialStep4 = 'hashkey%3dpwfhcqoqzgmho4w6%26choosepayment%3dall%26encrypttype%3d1%26itemname%3dmyitem%26merchantid%3d3002607%26merchanttradedate%3d2025%2f02%2f08+09%3a27%3a23%26merchanttradeno%3decpay1738978043%26paymenttype%3daio%26returnurl%3dhttps%3a%2f%2f08f6-211-23-76-78.ngrok-free.app%2freturnurl.php%26totalamount%3d30%26tradedesc%3dtrade%26hashiv%3dekrm7ift261dpevs'
    const officialStep5 = 'f1fb466ed0d6713dac7158ab6705914e37c93bd44fb8fa44c17f80cd17bb5728'

    // 詳細調試：檢查字符串的每個字符
    const step4Chars = step4.split('').map((char, index) => ({ char, index, code: char.charCodeAt(0) }))
    const officialStep4Chars = officialStep4.split('').map((char, index) => ({ char, index, code: char.charCodeAt(0) }))

    // 找出差異
    const differences = []
    for (let i = 0; i < Math.max(step4.length, officialStep4.length); i++) {
      const ourChar = step4[i] || 'MISSING'
      const officialChar = officialStep4[i] || 'MISSING'
      if (ourChar !== officialChar) {
        differences.push({
          index: i,
          ourChar,
          officialChar,
          ourCode: ourChar.charCodeAt(0),
          officialCode: officialChar.charCodeAt(0)
        })
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CheckMacValue 計算調試</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; word-break: break-all; border-left: 4px solid #2196F3; }
          .success { color: #4CAF50; font-weight: bold; }
          .error { color: #f44336; font-weight: bold; }
          .expected { color: #2196F3; font-weight: bold; }
          .warning { color: #ff9800; font-weight: bold; }
          .header { background: #2196F3; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .comparison { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .test-button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 5px; }
          .test-button:hover { background: #45a049; }
          .alternative { background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .param-list { background: #f9f9f9; padding: 10px; border-radius: 3px; margin: 10px 0; }
          .test-result { background: #f0f8ff; border: 1px solid #87ceeb; padding: 10px; border-radius: 5px; margin: 10px 0; }
          .official { background: #e3f2fd; border: 1px solid #2196F3; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .step-comparison { background: #fff8e1; border: 1px solid #ffb74d; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .diff { background: #ffebee; border: 1px solid #ef5350; padding: 5px; border-radius: 3px; margin: 5px 0; }
          .fix { background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .debug { background: #fff3e0; border: 1px solid #ffb74d; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 CheckMacValue 計算調試工具</h1>
            <p>使用綠界官方文檔的確切範例參數 - 修正 URLEncode 過度編碼問題</p>
          </div>

          <div class="fix">
            <h3>🔧 問題已修正</h3>
            <p><strong>發現的問題:</strong></p>
            <ul>
              <li>URLEncode 函數過度編碼了 <code>-</code> 和 <code>.</code> 字符</li>
              <li>導致字符串過長：375 vs 359 字符</li>
              <li>122 個字符位置存在差異</li>
            </ul>
            <p><strong>修正內容:</strong> 移除對 <code>-</code> 和 <code>.</code> 的編碼，讓它們保持原樣</p>
          </div>

          <div class="debug">
            <h3>🔧 字符級別調試</h3>
            <p><strong>我們的字符串長度:</strong> ${step4.length}</p>
            <p><strong>官方字符串長度:</strong> ${officialStep4.length}</p>
            <p><strong>差異數量:</strong> ${differences.length}</p>
            ${differences.length > 0 ? `
              <h4>發現的差異:</h4>
              <div class="code">
                ${differences.map(d => `位置 ${d.index}: 我們="${d.ourChar}"(${d.ourCode}) vs 官方="${d.officialChar}"(${d.officialCode})`).join('\n')}
              </div>
            ` : '<p><strong>✅ 沒有發現字符差異！</strong></p>'}
          </div>

          <div class="official">
            <h3>📋 綠界官方範例參數</h3>
            <div class="param-list">
              ${Object.entries(params).map(([key, value]) => `<strong>${key}:</strong> ${value}`).join('<br>')}
            </div>
          </div>
          
          <div class="step-comparison">
            <h3>📋 步驟 1: 排序參數比對</h3>
            <p><strong>我們的結果:</strong></p>
            <div class="code">${step1}</div>
            <p><strong>綠界官方:</strong></p>
            <div class="code">${officialStep1}</div>
            <p><strong>是否一致:</strong> 
              <span class="${step1 === officialStep1 ? 'success' : 'error'}">
                ${step1 === officialStep1 ? '✅ 是' : '❌ 否'}
              </span>
            </p>
          </div>
          
          <div class="step-comparison">
            <h3>🔑 步驟 2: 前面加 HashKey，後面加 HashIV 比對</h3>
            <p><strong>我們的結果:</strong></p>
            <div class="code">${step2}</div>
            <p><strong>綠界官方:</strong></p>
            <div class="code">${officialStep2}</div>
            <p><strong>是否一致:</strong> 
              <span class="${step2 === officialStep2 ? 'success' : 'error'}">
                ${step2 === officialStep2 ? '✅ 是' : '❌ 否'}
              </span>
            </p>
          </div>
          
          <div class="step-comparison">
            <h3>🌐 步驟 3: URL encode 比對 (修正版本)</h3>
            <p><strong>我們的結果:</strong></p>
            <div class="code">${step3}</div>
            <p><strong>綠界官方:</strong></p>
            <div class="code">${officialStep3}</div>
            <p><strong>是否一致:</strong> 
              <span class="${step3 === officialStep3 ? 'success' : 'error'}">
                ${step3 === officialStep3 ? '✅ 是' : '❌ 否'}
              </span>
            </p>
          </div>
          
          <div class="step-comparison">
            <h3>📝 步驟 4: 轉小寫比對</h3>
            <p><strong>我們的結果:</strong></p>
            <div class="code">${step4}</div>
            <p><strong>綠界官方:</strong></p>
            <div class="code">${officialStep4}</div>
            <p><strong>是否一致:</strong> 
              <span class="${step4 === officialStep4 ? 'success' : 'error'}">
                ${step4 === officialStep4 ? '✅ 是' : '❌ 否'}
              </span>
            </p>
          </div>
          
          <div class="step-comparison">
            <h3>🔐 步驟 5: SHA256 加密比對</h3>
            <p><strong>我們的結果:</strong></p>
            <div class="code">${step5}</div>
            <p><strong>綠界官方:</strong></p>
            <div class="code">${officialStep5}</div>
            <p><strong>是否一致:</strong> 
              <span class="${step5 === officialStep5 ? 'success' : 'error'}">
                ${step5 === officialStep5 ? '✅ 是' : '❌ 否'}
              </span>
            </p>
          </div>
          
          <div class="step">
            <h3>📊 步驟 6: 轉大寫 (我們的結果)</h3>
            <div class="code success">${step6}</div>
          </div>
          
          <div class="comparison">
            <h3>🎯 最終比對結果</h3>
            <p><strong>綠界官方預期:</strong></p>
            <div class="code expected">${expectedCheckMacValue}</div>
            <p><strong>我們的結果:</strong></p>
            <div class="code ${step6 === expectedCheckMacValue ? 'success' : 'error'}">${step6}</div>
            <p><strong>比對結果:</strong> 
              <span class="${step6 === expectedCheckMacValue ? 'success' : 'error'}">
                ${step6 === expectedCheckMacValue ? '✅ 完全一致！' : '❌ 不一致！'}
              </span>
            </p>
          </div>
          
          <div class="step">
            <h3>📈 詳細分析</h3>
            <p><strong>我們的結果長度:</strong> ${step6.length}</p>
            <p><strong>預期結果長度:</strong> ${expectedCheckMacValue.length}</p>
            <p><strong>是否長度相同:</strong> ${step6.length === expectedCheckMacValue.length ? '✅ 是' : '❌ 否'}</p>
            <p><strong>前10個字符:</strong> ${step6.substring(0, 10)} vs ${expectedCheckMacValue.substring(0, 10)}</p>
            <p><strong>前10個字符是否相同:</strong> ${step6.substring(0, 10) === expectedCheckMacValue.substring(0, 10) ? '✅ 是' : '❌ 否'}</p>
          </div>

          <div class="step">
            <h3>🧪 測試按鈕</h3>
            <button class="test-button" onclick="window.open('https://peiplay.vercel.app/api/payment/ecpay/urlencode-test', '_blank')">測試 URLEncode 工具</button>
            <button class="test-button" onclick="window.open('https://peiplay.vercel.app/api/payment/ecpay/official-exact', '_blank')">測試官方確切範例</button>
          </div>

          <div class="step">
            <h3>⚠️ 重要說明</h3>
            <ul>
              <li>此測試使用綠界官方文檔的確切範例參數</li>
              <li>已修正 URLEncode 過度編碼問題：移除對 <code>-</code> 和 <code>.</code> 的編碼</li>
              <li>已修正空格編碼：空格編碼為 <code>+</code> 而非 <code>%20</code></li>
              <li>每個步驟都與綠界官方文檔進行比對</li>
              <li>如果某個步驟不一致，表示我們的計算邏輯有問題</li>
              <li>新增字符級別調試，檢查是否有隱藏字符差異</li>
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
    console.error('Debug calc error:', error)
    return NextResponse.json(
      { error: '計算調試失敗' },
      { status: 500 }
    )
  }
}
