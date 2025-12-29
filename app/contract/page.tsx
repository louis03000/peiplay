'use client'

export default function ContractPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pt-32">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* 標題區域 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">📋 PeiPlay 服務條款（Terms of Service）</h1>
            <p className="text-blue-100">
              歡迎您使用「PeiPlay」（以下稱「本平台」）。本服務條款（以下稱「本條款」）係由 昇祺科技（以下稱「本公司」）所制定，規範使用者於使用本平台所享有之權利義務。
            </p>
            <p className="text-blue-100 mt-2">
              當您完成註冊、登入、瀏覽、預約、付款或以任何方式使用本平台之服務，即視為您已詳細閱讀、理解並同意受本條款之拘束。若您不同意本條款之全部或部分內容，請立即停止使用本平台。
            </p>
          </div>

          {/* 內容區域 */}
          <div className="px-6 py-8 space-y-8 prose max-w-none">
            
            {/* 第一條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第一條｜平台性質與服務說明</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <p className="text-gray-700 mb-3">
                  本平台係提供一個<strong>線上資訊媒合與預約管理系統</strong>，供使用者與第三方陪玩師（以下稱「服務提供者」）進行陪玩、語音互動或其他陪伴性質之服務預約。
                </p>
                <p className="text-gray-700 mb-3">
                  本平台並非實際服務之提供者，所有服務內容均由服務提供者自行提供，平台僅就資訊展示、預約安排、金流與系統支援提供技術性協助。
                </p>
                <p className="text-gray-700">
                  使用者理解並同意，本平台不介入服務實際進行內容，亦不對服務結果提供任何形式之保證。
                </p>
              </div>
            </section>

            {/* 第二條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第二條｜帳號註冊與使用義務</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>使用者應提供真實、正確且完整之註冊資料，並隨時維持其最新狀態。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>使用者須自行妥善保管帳號及密碼，因帳號遭他人不當使用所生之一切法律責任，概由使用者自行負責。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>使用者不得：</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-green-600 mr-2">-</span>
                    <span>冒用他人身分註冊帳號</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-green-600 mr-2">-</span>
                    <span>以非法或不當方式使用本平台</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-green-600 mr-2">-</span>
                    <span>干擾或破壞本平台系統運作</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第三條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第三條｜服務預約與成立</h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>使用者透過本平台所進行之預約，僅於完成付款後始成立。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>預約成立後，雙方應依預約內容準時履行服務。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>使用者理解，若未於指定期限內完成付款，平台得自動取消該預約並釋放時段。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第四條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第四條｜費用、付款與金流</h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>平台所顯示之服務價格，均由服務提供者自行設定。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>使用者應依平台所示之付款方式完成付款。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>所有交易款項將依平台金流機制暫由平台保管，並於服務完成後依約定結算予服務提供者。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第五條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第五條｜取消、退款與爭議處理</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>使用者於服務開始前取消預約者，退款比例依平台公告之規則處理。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>若使用者於服務開始後取消、遲到或未出席，視為已使用服務，原則上不予退款。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>若服務提供者無正當理由未依約提供服務，平台得視情況協助退款或安排替代方案。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>平台保留最終退款與補償判斷權。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第六條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第六條｜服務行為規範</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-gray-700 mb-3">使用者與服務提供者均不得於平台或服務過程中有下列行為：</p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    <span>任何形式之性交易、色情、裸露或暗示性行為</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    <span>詐欺、脅迫、恐嚇、騷擾、誹謗或歧視言論</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    <span>要求或散布他人個人隱私資料</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    <span>私下交易、規避平台金流或誘導離站交易</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    <span>違反中華民國法律或公序良俗之行為</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第七條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第七條｜智慧財產權</h2>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2">•</span>
                    <span>本平台所有系統、程式、版面設計、文字內容與商標，均屬本公司或其合法授權人所有。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-600 mr-2">•</span>
                    <span>未經授權，不得擅自重製、改作、散布或利用。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第八條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第八條｜責任限制與免責聲明</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2">•</span>
                    <span>本平台僅提供資訊與技術服務，不保證服務品質、滿意度或結果。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2">•</span>
                    <span>因使用者或服務提供者行為所生之一切糾紛、損害或法律責任，概由行為人自行負責。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gray-600 mr-2">•</span>
                    <span>本平台對於任何間接、附帶或衍生性損害，不負賠償責任。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第九條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第九條｜帳號停權與終止</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>使用者如違反本條款或相關法令，平台得不經通知，暫停或終止其帳號使用權限。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>平台終止帳號後，仍得就既有交易與爭議進行必要處理。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第十條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第十條｜條款修改權</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>本平台得隨時修改本條款內容，並公告於平台上。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>使用者於條款修改後繼續使用本平台，視為同意修訂後之條款。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第十一條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第十一條｜準據法與管轄</h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>本條款之解釋與適用，均以<strong>中華民國法律</strong>為準據法。</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>因本條款所生之一切爭議，以<strong>臺灣士林地方法院</strong>為第一審管轄法院。</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 第十二條 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">第十二條｜聯絡方式</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <p className="text-gray-700 mb-4">
                  如對本條款有任何疑問，請透過本平台客服管道與我們聯繫。
                </p>
                <div className="space-y-2 text-gray-700">
                  <p><strong>公司名稱：</strong>昇祺科技</p>
                  <p><strong>統一編號：</strong>95367956</p>
                  <p><strong>服務平台：</strong>PeiPlay</p>
                </div>
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
