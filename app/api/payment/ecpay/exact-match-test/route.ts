import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// 綠界金流設定
const ECPAY_CONFIG = {
  MERCHANT_ID: '3464691',
  HASH_KEY: 'ilByxKjPNI9qpHBK',
  HASH_IV: 'OTzB3pify1U9G0j6'
}

// 綠界特定的 URL 編碼函數（空格編碼為 +，不是 %20）
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
}

export async function GET() {
  try {
    // 使用綠界技術部門提供的確切參數
    const params = {
      "MerchantID": "3464691",
      "MerchantTradeNo": "PEI250829154847512",
      "MerchantTradeDate": "2025/08/29 15:48:47",
      "PaymentType": "aio",
      "TotalAmount": "300",
      "TradeDesc": "louis030 - 1 個時段",
      "ItemName": "PeiPlay 遊戲夥伴預約 - louis030 - 1 個時段",
      "ReturnURL": "https://peiplay.vercel.app/api/payment/callback",
      "ClientBackURL": "https://peiplay.vercel.app/booking",
      "OrderResultURL": "https://peiplay.vercel.app/booking",
      "ChoosePayment": "ALL",
      "EncryptType": "1",
      "Language": "ZH-TW",
      "NeedExtraPaidInfo": "N",
      "Redeem": "N",
      "UnionPay": "0",
      "IgnorePayment": "WebATM#ATM#CVS#BARCODE",
      "ExpireDate": "7",
      "PaymentInfoURL": "https://peiplay.vercel.app/api/payment/callback",
      "ClientRedirectURL": "https://peiplay.vercel.app/booking"
    }

    // 步驟 1: 排序參數（綠界官方方式）
    const sortedKeys = Object.keys(params).sort((a, b) => {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          return a[i].localeCompare(b[i])
        }
      }
      return a.length - b.length
    })
    
    let step1 = ''
    for (const key of sortedKeys) {
      step1 += `${key}=${params[key as keyof typeof params]}&`
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

    // 綠界官方預期的 CheckMacValue
    const expectedCheckMacValue = 'C65CC9CD9442E0D5A86CBED23F17CFA40EA20DF4A5CB0C5AE03753C5F4B3693B'

    // 檢查我們的計算是否正確
    const isCorrect = step6 === expectedCheckMacValue

    // 綠界範例的步驟 3 結果（用我們的 HashKey 和 HashIV 替換）
    const ecpayExampleStep3 = step3.replace(ECPAY_CONFIG.HASH_KEY, '****************').replace(ECPAY_CONFIG.HASH_IV, '****************')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界 CheckMacValue 精確匹配測試</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: ${isCorrect ? '#4CAF50' : '#f44336'}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .step { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
          .step h3 { margin-top: 0; color: #2196F3; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; word-break: break-all; margin: 10px 0; font-size: 11px; }
          .result { background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .error { background: #ffebee; border: 1px solid #f44336; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .note { background: #e3f2fd; border: 1px solid #2196F3; padding: 10px; border-radius: 5px; margin: 10px 0; }
          .comparison { background: #fff3e0; border: 1px solid #ff9800; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .highlight { background: #ffeb3b; padding: 2px 4px; border-radius: 3px; }
          .diff { background: #ffcdd2; padding: 2px 4px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 綠界 CheckMacValue 精確匹配測試</h1>
            <p>直接對比我們的計算與綠界範例的每一步</p>
            <p><strong>狀態：</strong> ${isCorrect ? '✅ 計算正確' : '❌ 計算錯誤'}</p>
          </div>

          <div class="step">
            <h3>📋 步驟 1: 參數排序（綠界官方方式）</h3>
            <p>按照第一個英文字母 A-Z 排序，相同時比較第二個字母</p>
            <p><strong>排序後的參數順序：</strong></p>
            <div class="code">${sortedKeys.join(' → ')}</div>
            <p><strong>組合後的查詢字串：</strong></p>
            <div class="code">${step1}</div>
          </div>

          <div class="step">
            <h3>🔑 步驟 2: 加上 HashKey 和 HashIV</h3>
            <p><strong>HashKey：</strong> <span class="highlight">${ECPAY_CONFIG.HASH_KEY}</span></p>
            <p><strong>HashIV：</strong> <span class="highlight">${ECPAY_CONFIG.HASH_IV}</span></p>
            <div class="code">${step2}</div>
          </div>

          <div class="step">
            <h3>🌐 步驟 3: URL Encode（關鍵步驟）</h3>
            <p>使用綠界特定的編碼方式（空格編碼為 +）</p>
            <div class="code">${step3}</div>
            
            <h4>🔍 與綠界範例對比：</h4>
            <p><strong>我們的結果（隱藏 HashKey/IV）：</strong></p>
            <div class="code">${ecpayExampleStep3}</div>
            
            <p><strong>綠界範例（隱藏 HashKey/IV）：</strong></p>
            <div class="code">HashKey%3D****************%26ChoosePayment%3DALL%26ClientBackURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26ClientRedirectURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26EncryptType%3D1%26ExpireDate%3D7%26IgnorePayment%3DWebATM%23ATM%23CVS%23BARCODE%26ItemName%3DPeiPlay+%E9%81%8A%E6%88%B2%E5%A4%A5%E4%BC%B4%E9%A0%90%E7%B4%84+-+louis030+-+1+%E5%80%8B%E6%99%82%E6%AE%B5%26Language%3DZH-TW%26MerchantID%3D3464691%26MerchantTradeDate%3D2025%2F08%2F29+15%3A48%3A47%26MerchantTradeNo%3DPEI250829154847512%26NeedExtraPaidInfo%3DN%26OrderResultURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26PaymentInfoURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fapi%2Fpayment%2Fcallback%26PaymentType%3Daio%26Redeem%3DN%26ReturnURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fapi%2Fpayment%2Fcallback%26TotalAmount%3D300%26TradeDesc%3Dlouis030+-+1+%E5%80%8B%E6%99%82%E6%AE%B5%26UnionPay%3D0%26HashIV%3D****************</div>
            
            <h4>🔍 關鍵差異檢查：</h4>
            <p><strong>空格編碼檢查：</strong></p>
            <ul>
              <li>我們的編碼：${step3.includes('+') ? '✅ 包含 + 編碼' : '❌ 不包含 + 編碼'}</li>
              <li>綠界範例：✅ 包含 + 編碼</li>
              <li>差異：${step3.includes('+') ? '✅ 編碼方式一致' : '❌ 編碼方式不一致'}</li>
            </ul>
          </div>

          <div class="step">
            <h3>📝 步驟 4: 轉為小寫</h3>
            <div class="code">${step4}</div>
          </div>

          <div class="step">
            <h3>🔒 步驟 5: SHA256 加密</h3>
            <div class="code">${step5}</div>
          </div>

          <div class="step">
            <h3>⬆️ 步驟 6: 轉為大寫</h3>
            <div class="code">${step6}</div>
          </div>

          ${isCorrect ? 
            `<div class="result">
              <h3>✅ 驗證成功！</h3>
              <p><strong>我們的計算結果：</strong> ${step6}</p>
              <p><strong>綠界官方預期：</strong> ${expectedCheckMacValue}</p>
              <p>兩個值完全一致！CheckMacValue 計算邏輯已修正。</p>
            </div>` : 
            `<div class="error">
              <h3>❌ 驗證失敗</h3>
              <p><strong>我們的計算結果：</strong> ${step6}</p>
              <p><strong>綠界官方預期：</strong> ${expectedCheckMacValue}</p>
              <p>兩個值不一致，需要進一步檢查計算邏輯。</p>
            </div>`
          }

          <div class="comparison">
            <h3>🔍 詳細差異分析</h3>
            <p><strong>我們的 HashKey：</strong> ${ECPAY_CONFIG.HASH_KEY}</p>
            <p><strong>我們的 HashIV：</strong> ${ECPAY_CONFIG.HASH_IV}</p>
            <p><strong>參數數量：</strong> ${Object.keys(params).length}</p>
            <p><strong>排序邏輯：</strong> 按照第一個英文字母 A-Z 排序，相同時比較第二個字母</p>
            <p><strong>URL 編碼：</strong> 使用綠界特定的編碼方式（空格編碼為 +）</p>
            <p><strong>加密方式：</strong> SHA256</p>
          </div>

          <div class="note">
            <h3>📊 參數摘要</h3>
            <p><strong>商店代號：</strong> ${ECPAY_CONFIG.MERCHANT_ID}</p>
            <p><strong>訂單編號：</strong> PEI250829154847512</p>
            <p><strong>金額：</strong> 300</p>
            <p><strong>時間：</strong> 2025/08/29 15:48:47</p>
          </div>

          <div class="note">
            <h3>🚀 下一步建議</h3>
            ${isCorrect ? 
              `<p>✅ CheckMacValue 計算已正確，如果支付仍有問題，可能是：</p>
              <ul>
                <li>綠界後台設定問題</li>
                <li>付款方式未啟用</li>
                <li>商店狀態問題</li>
                <li>其他綠界後端問題</li>
              </ul>` : 
              `<p>❌ CheckMacValue 計算仍有問題，需要：</p>
              <ul>
                <li>檢查 URL 編碼的每個字符</li>
                <li>對比綠界範例的每個步驟</li>
                <li>檢查是否有其他編碼差異</li>
                <li>聯繫綠界技術支援</li>
              </ul>`
            }
          </div>
        </div>
      </body>
      </html>
    `
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })

  } catch (error) {
    console.error('CheckMacValue verification error:', error)
    return NextResponse.json(
      { error: 'CheckMacValue 驗證失敗' },
      { status: 500 }
    )
  }
}
