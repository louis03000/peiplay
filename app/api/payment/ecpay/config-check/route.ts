import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
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

    const checkHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>綠界配置檢查</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .success { color: #28a745; font-weight: bold; }
          .error { color: #dc3545; font-weight: bold; }
          .warning { color: #ffc107; font-weight: bold; }
          .info { background: #e7f3ff; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .config { background: #e8f4f8; padding: 10px; border-radius: 4px; }
          pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔧 綠界金流配置檢查</h1>
          
          <div class="info">
            <strong>檢查目標：</strong> 驗證綠界金流的配置是否正確
          </div>
          
          <div class="section">
            <h2>📋 當前配置</h2>
            <div class="config">
              <p><strong>MerchantID:</strong> ${ECPAY_CONFIG.MERCHANT_ID}</p>
              <p><strong>HashKey:</strong> ${ECPAY_CONFIG.HASH_KEY}</p>
              <p><strong>HashIV:</strong> ${ECPAY_CONFIG.HASH_IV}</p>
              <p><strong>Payment URL:</strong> ${ECPAY_CONFIG.PAYMENT_URL}</p>
              <p><strong>Return URL:</strong> ${ECPAY_CONFIG.RETURN_URL}</p>
              <p><strong>Client Back URL:</strong> ${ECPAY_CONFIG.CLIENT_BACK_URL}</p>
              <p><strong>Client Front URL:</strong> ${ECPAY_CONFIG.CLIENT_FRONT_URL}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>✅ 配置驗證</h2>
            <ul>
              <li>✅ MerchantID 格式: <span class="${ECPAY_CONFIG.MERCHANT_ID.length === 7 ? 'success' : 'error'}">${ECPAY_CONFIG.MERCHANT_ID.length} 字元</span></li>
              <li>✅ HashKey 長度: <span class="${ECPAY_CONFIG.HASH_KEY.length === 16 ? 'success' : 'error'}">${ECPAY_CONFIG.HASH_KEY.length} 字元</span></li>
              <li>✅ HashIV 長度: <span class="${ECPAY_CONFIG.HASH_IV.length === 16 ? 'success' : 'error'}">${ECPAY_CONFIG.HASH_IV.length} 字元</span></li>
              <li>✅ Payment URL: <span class="${ECPAY_CONFIG.PAYMENT_URL.includes('payment.ecpay.com.tw') ? 'success' : 'error'}">${ECPAY_CONFIG.PAYMENT_URL.includes('payment.ecpay.com.tw') ? '正確' : '錯誤'}</span></li>
              <li>✅ Return URL: <span class="${ECPAY_CONFIG.RETURN_URL.includes('peiplay.vercel.app') ? 'success' : 'error'}">${ECPAY_CONFIG.RETURN_URL.includes('peiplay.vercel.app') ? '正確' : '錯誤'}</span></li>
            </ul>
          </div>
          
          <div class="section">
            <h2>🔍 常見問題檢查</h2>
            <ul>
              <li>❓ 是否為正式環境配置: <span class="warning">需要確認</span></li>
              <li>❓ 商店是否已開啟收款服務: <span class="warning">需要確認</span></li>
              <li>❓ 是否已設定付款方式: <span class="warning">需要確認</span></li>
              <li>❓ 是否已設定回調網址: <span class="success">已設定</span></li>
            </ul>
          </div>
          
          <div class="section">
            <h2>📞 聯繫綠界客服</h2>
            <p>如果配置都正確但仍然出現 CheckMacValue Error，建議聯繫綠界客服確認：</p>
            <ul>
              <li>商店編號 (MerchantID) 是否正確</li>
              <li>HashKey 和 HashIV 是否正確</li>
              <li>商店是否已開啟收款服務</li>
              <li>是否已設定付款方式</li>
              <li>回調網址是否已正確設定</li>
            </ul>
          </div>
          
          <div class="section">
            <h2>🧪 測試建議</h2>
            <p>建議按以下順序測試：</p>
            <ol>
              <li>先使用 <a href="/api/payment/ecpay/verify-fix" target="_blank">驗證修復工具</a> 測試</li>
              <li>如果驗證工具成功，再測試實際預約付款</li>
              <li>如果仍然失敗，聯繫綠界客服確認配置</li>
            </ol>
          </div>
          
          <div class="info">
            <strong>注意：</strong> CheckMacValue Error (10200073) 通常表示配置問題，而不是程式碼問題。
          </div>
        </div>
      </body>
      </html>
    `

    return new NextResponse(checkHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Config check error:', error)
    return NextResponse.json(
      { error: '配置檢查失敗' },
      { status: 500 }
    )
  }
}
