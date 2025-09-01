import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // 測試字符串
    const testString = "HashKey=ilByxKjPNI9qpHBK&ChoosePayment=ALL&ClientBackURL=https://peiplay.vercel.app/booking&ClientRedirectURL=https://peiplay.vercel.app/booking&EncryptType=1&ExpireDate=7&IgnorePayment=WebATM#ATM#CVS#BARCODE&ItemName=PeiPlay 遊戲夥伴預約 - louis030 - 1 個時段&Language=ZH-TW&MerchantID=3464691&MerchantTradeDate=2025/08/29 15:48:47&MerchantTradeNo=PEI250829154847512&NeedExtraPaidInfo=N&OrderResultURL=https://peiplay.vercel.app/booking&PaymentInfoURL=https://peiplay.vercel.app/api/payment/callback&PaymentType=aio&Redeem=N&ReturnURL=https://peiplay.vercel.app/api/payment/callback&TotalAmount=300&TradeDesc=louis030 - 1 個時段&UnionPay=0&HashIV=OTzB3pify1U9G0j6"

    // 測試不同的編碼方式
    const standardEncode = encodeURIComponent(testString)
    const customEncode = testString.replace(/%20/g, '+')
    
    // 檢查關鍵字符的編碼
    const hashCheck = testString.includes('#') ? '包含 #' : '不包含 #'
    const encodedHashCheck = standardEncode.includes('%23') ? '包含 %23' : '不包含 %23'
    const doubleEncodedCheck = standardEncode.includes('%2523') ? '包含 %2523' : '不包含 %2523'
    
    // 檢查中文字符編碼
    const chineseCheck = testString.includes('遊戲') ? '包含中文' : '不包含中文'
    const encodedChineseCheck = standardEncode.includes('%E9%81%8A') ? '包含編碼後中文' : '不包含編碼後中文'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>編碼函數測試</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #2196F3; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
          .section h3 { margin-top: 0; color: #2196F3; }
          .code { background: #f4f4f4; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; word-break: break-all; margin: 10px 0; font-size: 11px; }
          .highlight { background: #ffeb3b; padding: 2px 4px; border-radius: 3px; }
          .error { background: #ffebee; border: 1px solid #f44336; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .success { background: #e8f5e8; border: 1px solid #4CAF50; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔍 編碼函數測試</h1>
            <p>測試不同的編碼方式，找出問題所在</p>
          </div>

          <div class="section">
            <h3>📋 原始字符串</h3>
            <div class="code">${testString}</div>
          </div>

          <div class="section">
            <h3>🌐 標準 encodeURIComponent 結果</h3>
            <div class="code">${standardEncode}</div>
          </div>

          <div class="section">
            <h3>🔍 關鍵字符檢查</h3>
            <ul>
              <li><strong>原始字符串：</strong> ${hashCheck}</li>
              <li><strong>編碼後：</strong> ${encodedHashCheck}</li>
              <li><strong>雙重編碼檢查：</strong> ${doubleEncodedCheck}</li>
              <li><strong>中文字符：</strong> ${chineseCheck}</li>
              <li><strong>編碼後中文：</strong> ${encodedChineseCheck}</li>
            </ul>
          </div>

          <div class="section">
            <h3>🎯 問題診斷</h3>
            ${doubleEncodedCheck === '包含 %2523' ? 
              `<div class="error">
                <h4>❌ 發現問題：雙重編碼</h4>
                <p>字符串中的 <span class="highlight">#</span> 字符被編碼為 <span class="highlight">%2523</span>，這是雙重編碼的結果。</p>
                <p><strong>原因：</strong> 可能是編碼函數被調用了兩次，或者有其他編碼邏輯干擾。</p>
              </div>` : 
              `<div class="success">
                <h4>✅ 編碼正常</h4>
                <p>沒有發現雙重編碼問題。</p>
              </div>`
            }
            
            ${chineseCheck === '包含中文' && encodedChineseCheck === '不包含編碼後中文' ? 
              `<div class="error">
                <h4>❌ 發現問題：中文字符未編碼</h4>
                <p>中文字符沒有被正確編碼為 UTF-8 編碼。</p>
                <p><strong>原因：</strong> 編碼函數可能沒有被正確調用。</p>
              </div>` : 
              `<div class="success">
                <h4>✅ 中文字符編碼正常</h4>
                <p>中文字符被正確編碼。</p>
              </div>`
            }
          </div>

          <div class="section">
            <h3>🚀 建議解決方案</h3>
            <ol>
              <li><strong>檢查編碼函數調用：</strong> 確保編碼函數只被調用一次</li>
              <li><strong>檢查編碼順序：</strong> 先編碼，再處理空格</li>
              <li><strong>使用標準編碼：</strong> 直接使用 encodeURIComponent，然後只替換空格</li>
            </ol>
          </div>

          <div class="section">
            <h3>📊 編碼結果對比</h3>
            <p><strong>我們的編碼結果：</strong></p>
            <div class="code">HashKey%3DilByxKjPNI9qpHBK%26ChoosePayment%3DALL%26ClientBackURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26ClientRedirectURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26EncryptType%3D1%26ExpireDate%3D7%26IgnorePayment%3DWebATM%2523ATM%2523CVS%2523BARCODE%26ItemName%3DPeiPlay+遊戲夥伴預約+-+louis030+-+1+個時段%26Language%3DZH-TW%26MerchantID%3D3464691%26MerchantTradeDate%3D2025%2F08%2F29+15%3A48%3A47%26MerchantTradeNo%3DPEI250829154847512%26NeedExtraPaidInfo%3DN%26OrderResultURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26PaymentInfoURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fapi%2Fpayment%2Fcallback%26PaymentType%3Daio%26Redeem%3DN%26ReturnURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fapi%2Fpayment%2Fcallback%26TotalAmount%3D300%26TradeDesc%3Dlouis030+-+1+%E5%80%8B%E6%99%82%E6%AE%B5%26UnionPay%3D0%26HashIV%3DOTzB3pify1U9G0j6</div>
            
            <p><strong>綠界範例編碼結果：</strong></p>
            <div class="code">HashKey%3D****************%26ChoosePayment%3DALL%26ClientBackURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26ClientRedirectURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26EncryptType%3D1%26ExpireDate%3D7%26IgnorePayment%3DWebATM%23ATM%23CVS%23BARCODE%26ItemName%3DPeiPlay+%E9%81%8A%E6%88%B2%E5%A4%A5%E4%BC%B4%E9%A0%90%E7%B4%84+-+louis030+-+1+%E5%80%8B%E6%99%82%E6%AE%B5%26Language%3DZH-TW%26MerchantID%3D3464691%26MerchantTradeDate%3D2025%2F08%2F29+15%3A48%3A47%26MerchantTradeNo%3DPEI250829154847512%26NeedExtraPaidInfo%3DN%26OrderResultURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fbooking%26PaymentInfoURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fapi%2Fpayment%2Fcallback%26PaymentType%3Daio%26Redeem%3DN%26ReturnURL%3Dhttps%3A%2F%2Fpeiplay.vercel.app%2Fapi%2Fpayment%2Fcallback%26TotalAmount%3D300%26TradeDesc%3Dlouis030+-+1+%E5%80%8B%E6%99%82%E6%AE%B5%26UnionPay%3D0%26HashIV%3D****************</div>
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
    console.error('Encoding test error:', error)
    return NextResponse.json(
      { error: '編碼測試失敗' },
      { status: 500 }
    )
  }
}
