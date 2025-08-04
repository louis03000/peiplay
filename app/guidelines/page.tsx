'use client'

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pt-32">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* 標題區域 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">📘 Peiplay 夥伴使用規範</h1>
            <p className="text-blue-100">
              為維護平台服務品質、顧客體驗與營運秩序，Peiplay 制定以下夥伴使用規範。
              所有註冊為平台夥伴者，視為已詳閱並同意遵守本規範。
            </p>
          </div>

          {/* 內容區域 */}
          <div className="px-6 py-8 space-y-8">
            
            {/* 基本行為規範 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3">✅</span>
                一、基本行為規範
              </h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>不得提供任何超出平台列明之服務項目</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>包含但不限於：性暗示、裸露、私密互動、語音挑逗、私下約見面等行為，一律禁止</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>不得引導客戶至平台以外進行交易或私下聯絡</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>如私加 LINE、IG、Discord 並進行收費或延伸服務，將立即停權</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>不得散播不實言論或抹平台形象</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>包含社群發文、聊天室留言、顧客私訊，皆不得發布誇張失實或具惡意的評論</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>不得擅自承諾或提供非平台允許之優惠、時數或贈品</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>例如：「我私下陪你多半小時」「這場我免費送你」等皆禁止</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>不得冒用他人身份或使用虛假資料註冊</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>包含使用他人照片、名稱、虛構身份等行為</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>不得與顧客發展曖昧、親密或私密性質之互動</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>如顧客回報有越界行為，經查屬實即永久停權</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 接單與服務規範 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3">🔧</span>
                二、接單與服務規範
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>接單後需準時上線，遲到超過 10 分鐘視為違規一次</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>遲到或爽約將影響平台評分與信任度</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>無正當理由連續缺席 2 次以上，平台將自動暫停接單權限</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>如需請假或暫停服務，請於預約時間前 3 小時通知平台與顧客</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>服務時須保持禮貌、耐心、專業，不得與顧客爭執或情緒失控</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>服務中不得從事以下行為：</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-blue-600 mr-2">-</span>
                    <span>長時間靜音、無回應或離席</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-blue-600 mr-2">-</span>
                    <span>一邊陪玩一邊與他人語音 / 看影片 / 做其他事</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-blue-600 mr-2">-</span>
                    <span>明顯敷衍顧客、不配合、不講話</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 資訊與隱私規範 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3">🔒</span>
                三、資訊與隱私規範
              </h2>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>不得洩露顧客個資（如姓名、照片、聯絡方式等）</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>平台提供的帳號、後台資訊不得外流或借用他人使用</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    <span>不得擅自拍攝、錄音、錄影或截圖顧客對話內容公開分享</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 違規處理與懲處機制 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3">🚨</span>
                四、違規處理與懲處機制
              </h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-gray-700 mb-4">
                  違規將視情節輕重分為三種處理方式：
                </p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span><strong>輕度：</strong>口頭或書面警告一次</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span><strong>中度：</strong>暫停接單 7 天，需教育後復權</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span><strong>嚴重：</strong>永久停權，無法再登錄或重新註冊</span>
                  </li>
                </ul>
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 text-sm">
                    <strong>注意：</strong>若夥伴對平台處分有異議，可提出書面說明，由審核團隊處理與裁定是否復權。
                    平台保留最終調整、詮釋與終止合作之權利，不另行通知。
                  </p>
                </div>
              </div>
            </section>

            {/* 補充條款與管理機制 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3">📌</span>
                五、補充條款與管理機制
              </h2>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>夥伴上線前須完成「服務界線教育」與「同意書簽署」</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-orange-600 mr-2">-</span>
                    <span>含：《Peiplay 夥伴行為規範》、《個資保密條款》、《服務界線說明》等</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>所有夥伴需簽署正式《服務同意書》，並願意接受後續內容變動之更新通知</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>平台實施顧客回饋機制，若收到連續 3 次差評將進行停權審核</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 mr-2">•</span>
                    <span>若有「低於 2 星」、「嚴重抱怨」、「行為不專業」等紀錄</span>
                  </li>
                  <li className="flex items-start ml-6">
                    <span className="text-orange-600 mr-2">-</span>
                    <span>將進入個別觀察與教育輔導期，並可能停權 7 日～永久</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 聯絡資訊 */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-3">📞</span>
                聯絡我們
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <p className="text-gray-700 mb-4">
                  此規範目的為維護所有誠實、認真服務的夥伴，也保護顧客不受傷害。
                  若有疑慮、申訴或建議，歡迎聯繫管理團隊：
                </p>
                <div className="space-y-2 text-gray-700">
                  <p><strong>📧 電子郵件：</strong>support@peiplay.com</p>
                  <p><strong>💬 Discord：</strong>peiplay.vercel.app</p>
                  <p><strong>📱 客服時間：</strong>週一至週日 09:00-21:00</p>
                </div>
              </div>
            </section>

            {/* 返回按鈕 */}
            <div className="flex justify-center pt-8">
              <a
                href="/join"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                返回申請頁面
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 