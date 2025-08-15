import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>綠界後端設定檢查清單</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; }
        .header { background: #2196F3; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .checklist { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .item { margin: 10px 0; padding: 10px; border-left: 4px solid #2196F3; background: white; }
        .critical { border-left-color: #f44336; background: #ffebee; }
        .important { border-left-color: #ff9800; background: #fff3e0; }
        .normal { border-left-color: #4CAF50; background: #e8f5e8; }
        .code { background: #f4f4f4; padding: 5px; border-radius: 3px; font-family: monospace; }
        .note { background: #e3f2fd; border: 1px solid #2196F3; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔧 綠界後端設定檢查清單</h1>
          <p>由於 CheckMacValue 計算正確，問題可能出在後端設定</p>
        </div>

        <div class="section">
          <h2>📋 基本設定檢查</h2>
          <div class="checklist">
            <div class="item critical">
              <h3>1. 商店基本資料</h3>
              <p><strong>位置：</strong> 商店管理 → 商店基本資料</p>
              <ul>
                <li>✅ 商店代號：<code>3464691</code></li>
                <li>✅ HashKey：<code>ilByxKjPNI9qpHBK</code></li>
                <li>✅ HashIV：<code>OTzB3pify1U9G0j6</code></li>
                <li>❓ 商店狀態：必須為「啟用」</li>
                <li>❓ 商店類型：個人/企業/特約商店</li>
              </ul>
            </div>

            <div class="item critical">
              <h3>2. 雙因子驗證 (2FA)</h3>
              <p><strong>位置：</strong> 商店管理 → 雙因子驗證</p>
              <ul>
                <li>❓ 是否已啟用雙因子驗證？</li>
                <li>❓ 是否已完成驗證流程？</li>
              </ul>
            </div>

            <div class="item critical">
              <h3>3. 收款連結設定</h3>
              <p><strong>位置：</strong> 收款連結管理</p>
              <ul>
                <li>❓ 是否已建立收款連結？</li>
                <li>❓ 收款連結是否已啟用？</li>
                <li>❓ 連結狀態是否為「啟用中」？</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>🌐 URL 設定檢查</h2>
          <div class="checklist">
            <div class="item important">
              <h3>4. 回調 URL 設定</h3>
              <p><strong>位置：</strong> 商店管理 → 商店基本資料 → 回調設定</p>
              <ul>
                <li>✅ ReturnURL：<code>https://peiplay.vercel.app/api/payment/callback</code></li>
                <li>✅ ClientBackURL：<code>https://peiplay.vercel.app/booking</code></li>
                <li>✅ ClientFrontURL：<code>https://peiplay.vercel.app/booking</code></li>
                <li>❓ 這些 URL 是否已在綠界後端設定？</li>
              </ul>
            </div>

            <div class="item important">
              <h3>5. 付款服務審核狀態</h3>
              <p><strong>位置：</strong> 付款服務管理</p>
              <ul>
                <li>❓ 信用卡付款：是否已通過審核？</li>
                <li>❓ 網路 ATM：是否已通過審核？</li>
                <li>❓ 超商代碼：是否已通過審核？</li>
                <li>❓ 超商條碼：是否已通過審核？</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>💳 付款方式設定</h2>
          <div class="checklist">
            <div class="item important">
              <h3>6. 付款方式啟用狀態</h3>
              <p><strong>位置：</strong> 收款連結管理 → 編輯連結 → 付款方式</p>
              <ul>
                <li>❓ 信用卡：是否已勾選啟用？</li>
                <li>❓ Apple Pay：是否已勾選啟用？</li>
                <li>❓ 網路 ATM：是否已勾選啟用？</li>
                <li>❓ 超商代碼：是否已勾選啟用？</li>
                <li>❓ 超商條碼：是否已勾選啟用？</li>
              </ul>
            </div>

            <div class="item normal">
              <h3>7. 金額設定</h3>
              <p><strong>位置：</strong> 收款連結管理 → 編輯連結 → 金額設定</p>
              <ul>
                <li>❓ 金額類型：是否設為「由消費者填寫」？</li>
                <li>❓ 最小金額：是否有設定限制？</li>
                <li>❓ 最大金額：是否有設定限制？</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>🔍 常見問題檢查</h2>
          <div class="checklist">
            <div class="item critical">
              <h3>8. 環境設定</h3>
              <ul>
                <li>❓ 是否在正式環境而非測試環境？</li>
                <li>❓ 商店是否已通過綠界審核？</li>
                <li>❓ 是否有任何未完成的審核項目？</li>
              </ul>
            </div>

            <div class="item important">
              <h3>9. 錯誤代碼對應</h3>
              <ul>
                <li><strong>10200073 (CheckMacValue Error)</strong>：通常是參數問題，但我們已確認計算正確</li>
                <li><strong>10300023 (無付款方式)</strong>：付款方式未啟用</li>
                <li><strong>1000500 (訂單編號長度)</strong>：我們已確認符合 20 字元限制</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>📞 聯繫綠界客服</h2>
          <div class="note">
            <h3>如果以上設定都正確，建議聯繫綠界客服：</h3>
            <ul>
              <li><strong>客服電話：</strong> 02-2655-1775</li>
              <li><strong>客服時間：</strong> 週一至週五 9:00-18:00</li>
              <li><strong>準備資料：</strong>
                <ul>
                  <li>商店代號：3464691</li>
                  <li>錯誤代碼：10200073</li>
                  <li>測試訂單編號範例</li>
                  <li>我們的 CheckMacValue 計算結果</li>
                </ul>
              </li>
            </ul>
          </div>
        </div>

        <div class="section">
          <h2>🧪 測試建議</h2>
          <div class="warning">
            <h3>在聯繫客服前，可以嘗試：</h3>
            <ul>
              <li>使用綠界官方的測試工具驗證 CheckMacValue</li>
              <li>檢查是否有其他商店使用相同設定成功</li>
              <li>確認所有付款方式的審核狀態</li>
              <li>檢查商店是否有任何限制或暫停</li>
            </ul>
          </div>
        </div>

        <div class="section">
          <h2>📊 我們的設定摘要</h2>
          <div class="code">
            <strong>商店代號：</strong> 3464691<br>
            <strong>HashKey：</strong> ilByxKjPNI9qpHBK<br>
            <strong>HashIV：</strong> OTzB3pify1U9G0j6<br>
            <strong>ReturnURL：</strong> https://peiplay.vercel.app/api/payment/callback<br>
            <strong>ClientBackURL：</strong> https://peiplay.vercel.app/booking<br>
            <strong>ClientFrontURL：</strong> https://peiplay.vercel.app/booking<br>
            <strong>付款方式：</strong> ALL (支援所有付款方式)<br>
            <strong>CheckMacValue：</strong> ✅ 計算正確
          </div>
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
}
