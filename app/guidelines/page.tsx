'use client'

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pt-32">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* 標題區域 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">📘 PeiPlay 使用指南（完整說明）</h1>
            <p className="text-blue-100">
              本指南適用於 PeiPlay 陪玩平台的所有使用者，包含「一般玩家／顧客」與「陪玩師／夥伴」。
              內容將從平台定位、註冊流程、預約與付款、服務進行方式、取消退款規則、常見問題與注意事項，完整說明 PeiPlay 的使用方式。
            </p>
          </div>

          {/* 內容區域 */}
          <div className="px-6 py-8 space-y-8 prose max-w-none">
            
            {/* 一、PeiPlay 是什麼？ */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">一、PeiPlay 是什麼？</h2>
              <p className="text-gray-700 mb-4">
                PeiPlay 是一個<strong>線上陪玩與即時互動服務平台</strong>，提供使用者透過預約方式，與陪玩師進行遊戲陪玩、語音聊天或互動陪伴。
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">平台特色</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>採「預約制」，避免搶單與混亂</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>價格與服務內容事前透明顯示</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>支援即時通訊與語音平台（如 Discord）</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>陪玩師皆需遵守平台行為規範</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 二、使用者類型說明 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">二、使用者類型說明</h2>
              <p className="text-gray-700 mb-4">PeiPlay 分為兩種主要角色：</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">1️⃣ 一般使用者（玩家／顧客）</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span>瀏覽陪玩師資料</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span>預約時段與服務</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span>完成付款後獲得陪玩服務</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">2️⃣ 陪玩師（夥伴）</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>建立個人服務頁面</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>設定可接單時段與價格</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>於約定時間提供服務</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 三、一般使用者使用流程 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">三、一般使用者使用流程（玩家）</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 1：註冊與登入</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>進入 PeiPlay 官方網站</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>使用 Email 或指定方式完成註冊</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>登入後即可開始瀏覽服務</span>
                    </li>
                  </ul>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-yellow-800 text-sm">
                      ⚠️ 請確認填寫正確的聯絡方式，以利後續通知與服務對接。
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 2：瀏覽陪玩師與服務內容</h3>
                  <p className="text-gray-700 mb-3">在平台上，你可以查看每位陪玩師的：</p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>暱稱與頭像</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>擅長遊戲／服務類型</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>每 30 分鐘或每小時的服務價格</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>可預約時段（行事曆顯示）</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>個人介紹與服務說明</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 3：選擇時段並送出預約</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>點選想要的陪玩師</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>選擇可預約的日期與時段</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>確認服務內容與價格</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>送出預約申請</span>
                    </li>
                  </ul>
                  <p className="text-gray-700 mt-3">系統將即時檢查：</p>
                  <ul className="space-y-2 text-gray-700 ml-4">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">-</span>
                      <span>是否有重複預約</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">-</span>
                      <span>時段是否仍可使用</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 4：完成付款</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>預約確認後，需於指定時間內完成付款</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>付款完成後，預約才會正式成立</span>
                    </li>
                  </ul>
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-green-800 text-sm">
                      💡 若未完成付款，系統將自動釋放該時段。
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 5：服務進行</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>於預約時間前，請提前進入指定通訊平台（如 Discord）</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>確認陪玩師已在線</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>於約定時段內進行陪玩或互動服務</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 6：服務結束</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>服務將於約定時間結束</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span>若需延長服務，請重新預約</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 四、陪玩師使用流程 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">四、陪玩師使用流程（夥伴）</h2>
              
              <div className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 1：成為陪玩師</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>註冊 PeiPlay 帳號</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>申請成為陪玩師</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>填寫以下資訊：</span>
                    </li>
                    <li className="flex items-start ml-6">
                      <span className="text-purple-600 mr-2">-</span>
                      <span>暱稱與頭像</span>
                    </li>
                    <li className="flex items-start ml-6">
                      <span className="text-purple-600 mr-2">-</span>
                      <span>擅長項目</span>
                    </li>
                    <li className="flex items-start ml-6">
                      <span className="text-purple-600 mr-2">-</span>
                      <span>服務說明</span>
                    </li>
                    <li className="flex items-start ml-6">
                      <span className="text-purple-600 mr-2">-</span>
                      <span>價格設定</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 2：設定可接單時段</h3>
                  <p className="text-gray-700 mb-3">陪玩師可於後台：</p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>設定每週可接單時間</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>調整臨時不可接單時段</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>避免時段重疊與衝突</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 3：接收預約通知</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>當使用者完成預約並付款後</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>系統將通知陪玩師</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>請準時於指定平台上線</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Step 4：提供服務</h3>
                  <p className="text-gray-700 mb-3">陪玩師需：</p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>準時出席</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>提供與頁面描述一致的服務</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>保持良好態度與專業行為</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 五、取消與退款規則 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">五、取消與退款規則（重要）</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">使用者取消</h3>
                <ul className="space-y-2 text-gray-700 mb-4">
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>服務開始前取消：依平台公告之退款比例處理</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>服務開始後取消或未出席：不予退款</span>
                  </li>
                </ul>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">陪玩師未出席</h3>
                <ul className="space-y-2 text-gray-700 mb-4">
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>若陪玩師無故未出席</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>平台將協助退款或安排補償</span>
                  </li>
                </ul>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ 實際退款規則以平台最新公告為準。
                  </p>
                </div>
              </div>
            </section>

            {/* 六、平台行為規範 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">六、平台行為規範</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">禁止事項（包含但不限於）：</h3>
                <ul className="space-y-2 text-gray-700 mb-4">
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>色情、性交易或暗示性行為</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>人身攻擊、歧視、威脅</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>私下繞過平台交易</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>要求提供個人隱私資訊</span>
                  </li>
                </ul>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">違反者可能面臨：</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>警告</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>暫停帳號</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>永久停權</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 七、常見問題 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">七、常見問題（FAQ）</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Q1：可以臨時改時間嗎？</h3>
                    <p className="text-gray-700">需視陪玩師是否同意，平台不保證可更改。</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Q2：服務品質不符怎麼辦？</h3>
                    <p className="text-gray-700">請於服務結束後聯繫客服，提供相關說明。</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Q3：可以私下聯絡陪玩師嗎？</h3>
                    <p className="text-gray-700">平台不建議，也不保障私下交易之權益。</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 八、使用建議 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">八、使用建議</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">給玩家的建議</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span>事前清楚閱讀服務說明</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span>準時上線，避免浪費服務時間</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">給陪玩師的建議</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>清楚描述服務內容</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span>準時、穩定、態度良好</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 九、結語 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">九、結語</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-gray-700 mb-4">
                  PeiPlay 致力於打造<strong>安全、透明、穩定的陪玩預約平台</strong>。
                </p>
                <p className="text-gray-700 mb-4">
                  希望本指南能幫助你快速上手，享受良好的陪玩體驗 🤝
                </p>
                <p className="text-gray-700">
                  如有任何問題，請隨時聯繫 PeiPlay 客服支援。
                </p>
              </div>
            </section>

            {/* 返回按鈕 */}
            <div className="flex justify-center pt-8">
              <a
                href="/"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                返回首頁
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
