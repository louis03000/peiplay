'use client'

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pt-32">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* 標題區域 */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">💰 PeiPlay 退款規則（Refund Policy）</h1>
            <p className="text-red-100">
              本退款規則適用於 PeiPlay 平台所有預約服務，請詳細閱讀並理解相關規定。
            </p>
          </div>

          {/* 內容區域 */}
          <div className="px-6 py-8 space-y-8 prose max-w-none">
            
            {/* 一、服務內容說明 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">一、服務內容說明</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-gray-700 mb-3">
                  PeiPlay 為<strong>線上陪玩媒合平台</strong>，提供使用者預約陪玩師進行即時語音互動與遊戲陪同之服務。
                </p>
                <p className="text-gray-700 mb-3">
                  本服務屬<strong>「預約制時間型數位服務」</strong>，服務時間與陪玩師人數依使用者下單內容為準。
                </p>
                <p className="text-gray-700">
                  平台將於服務開始時，為該筆訂單建立專屬 Discord 語音頻道，作為服務交付與履行之依據。
                </p>
              </div>
            </section>

            {/* 二、服務履行認定標準 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">二、服務履行認定標準（非常重要）</h2>
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                <p className="text-red-800 font-semibold mb-4 text-lg">
                  當平台成功建立該筆訂單之 Discord 專屬頻道時，即視為服務已開始並完成交付要件。
                </p>
                <div className="bg-white border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-gray-800 font-semibold mb-2">一經建立 Discord 頻道：</p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2 font-bold">✗</span>
                      <span>視為服務已開始</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2 font-bold">✗</span>
                      <span>不接受取消</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2 font-bold">✗</span>
                      <span>不提供部分退款</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-2 font-bold">✗</span>
                      <span>不因主觀感受申請退款</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 三、取消與退款規則 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">三、取消與退款規則</h2>
              
              {/* （一）使用者主動取消 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">（一）使用者主動取消</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">取消時間點（以預約開始時間計）</th>
                        <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">退款方式</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-3 text-gray-700">開始前 24 小時（含）</td>
                        <td className="border border-gray-300 px-4 py-3 text-green-600 font-semibold">全額退款</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 text-gray-700">開始前 12–24 小時</td>
                        <td className="border border-gray-300 px-4 py-3 text-yellow-600 font-semibold">退還 50%</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-3 text-gray-700">開始前 12 小時內</td>
                        <td className="border border-gray-300 px-4 py-3 text-red-600 font-semibold">不予退款</td>
                      </tr>
                      <tr className="bg-red-50">
                        <td className="border border-gray-300 px-4 py-3 text-gray-700 font-semibold">Discord 頻道已建立</td>
                        <td className="border border-gray-300 px-4 py-3 text-red-600 font-semibold">不予退款</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                  <p className="text-yellow-800 font-semibold">
                    📌 多人陪玩訂單屬單一整體服務，恕不接受部分取消或部分退款。
                  </p>
                </div>
              </div>

              {/* （二）陪玩師或平台因素取消 */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">（二）陪玩師或平台因素取消</h3>
                <p className="text-gray-700 mb-4">
                  如因以下原因導致服務無法提供，使用者可申請 <strong className="text-green-600">100% 全額退款</strong>：
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2 font-bold">✓</span>
                    <span>陪玩師於服務開始前取消</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2 font-bold">✓</span>
                    <span>陪玩師未依約提供服務</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2 font-bold">✓</span>
                    <span>平台系統異常致無法建立 Discord 頻道</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2 font-bold">✓</span>
                    <span>其他可歸責於平台或陪玩師之情形</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 四、退款方式與作業時間 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">四、退款方式與作業時間</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2 font-bold">•</span>
                    <span>本平台採 <strong>人工審核與退款機制</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2 font-bold">•</span>
                    <span>退款將以原付款方式（綠界）退回</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2 font-bold">•</span>
                    <span>退款處理時間約 <strong>7–14 個工作天</strong></span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2 font-bold">•</span>
                    <span>實際入帳時間依支付機構或銀行為準</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 五、防止濫用聲明 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">五、防止濫用聲明</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <p className="text-gray-700">
                  平台保留對於短期內多次取消、惡意退款或濫用機制之帳號，限制其使用服務或終止帳號之權利。
                </p>
              </div>
            </section>

            {/* 前端提示文案說明 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">前端提示文案</h2>
              
              {/* 取消前提示 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">【取消前提示（彈窗）】</h3>
                <div className="bg-white border-2 border-yellow-400 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <span className="text-2xl mr-2">⚠️</span>
                    <h4 className="text-lg font-bold text-gray-900">取消提醒</h4>
                  </div>
                  <div className="space-y-3 text-gray-700 mb-6">
                    <p>本服務為預約制時間型服務</p>
                    <p>Discord 頻道建立後即視為服務已開始</p>
                    <p className="font-semibold text-red-600">服務開始後將無法取消或退款</p>
                    <p className="font-semibold">是否仍要取消本筆訂單？</p>
                  </div>
                  <div className="flex gap-4">
                    <button className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">
                      確認取消
                    </button>
                    <button className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors">
                      返回
                    </button>
                  </div>
                </div>
              </div>

              {/* 多人陪玩提示 */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">【多人陪玩提示】</h3>
                <div className="bg-white border border-purple-300 rounded-lg p-4">
                  <p className="text-purple-800 font-semibold">
                    📌 本訂單包含多位陪玩師<br />
                    取消將影響整筆訂單，不支援部分取消或部分退款
                  </p>
                </div>
              </div>

              {/* 服務即將開始提醒 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">【服務即將開始提醒（12 小時內）】</h3>
                <div className="bg-white border border-yellow-300 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">⏰</span>
                    <p className="text-yellow-800 font-semibold">
                      提醒您：<br />
                      本訂單已進入「不可退款時段」，取消將無法退還費用。
                    </p>
                  </div>
                </div>
              </div>

              {/* 服務開始後狀態顯示 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">【服務開始後狀態顯示】</h3>
                <div className="bg-white border border-green-300 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">✅</span>
                    <p className="text-green-800 font-semibold">
                      服務進行中<br />
                      Discord 頻道已建立，本筆訂單已完成履行條件。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 聯絡資訊 */}
            <section className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">需要協助？</h3>
              <p className="text-gray-700 mb-2">
                如有任何退款相關問題，請聯繫客服：
              </p>
              <p className="text-blue-600 font-semibold">
                客服信箱：peiplay987@gmail.com
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
