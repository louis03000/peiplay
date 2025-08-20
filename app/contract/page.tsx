'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function ContractPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 載入用戶資料
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUserData(data.user);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [session]);

  // 下載合作承攬合約書
  const downloadContract = async () => {
    // 動態導入 jsPDF
    const { jsPDF } = await import('jspdf');
    
    const doc = new jsPDF();
    
    // 設定中文字體支援
    doc.addFont('https://cdn.jsdelivr.net/npm/noto-sans-tc@1.0.0/NotoSansTC-Regular.otf', 'NotoSansTC', 'normal');
    doc.setFont('NotoSansTC');
    
    // 設定頁面格式
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;
    let y = margin;
    
    // 標題
    doc.setFontSize(18);
    doc.setFont('NotoSansTC', 'bold');
    const title = '陪玩合作承攬合約書';
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, y);
    y += lineHeight * 2;
    
    // 立約雙方
    doc.setFontSize(14);
    doc.setFont('NotoSansTC', 'bold');
    doc.text('立約雙方：', margin, y);
    y += lineHeight * 1.5;
    
    // 甲方資訊
    doc.setFontSize(12);
    doc.setFont('NotoSansTC', 'normal');
    doc.text('甲方（平台方／公司）', margin, y);
    y += lineHeight;
    doc.text('公司名稱：昇祺科技', margin + 10, y);
    y += lineHeight;
    doc.text('統一編號：95367956', margin + 10, y);
    y += lineHeight * 1.5;
    
    // 乙方資訊
    doc.text('乙方（合作夥伴）', margin, y);
    y += lineHeight;
    doc.text(`姓名：${userData?.name || '＿＿＿＿＿'}`, margin + 10, y);
    y += lineHeight;
    doc.text('身分證字號：＿＿＿＿＿', margin + 10, y);
    y += lineHeight;
    doc.text(`聯絡方式：${userData?.phone || '＿＿＿＿＿'}`, margin + 10, y);
    y += lineHeight * 2;
    
    // 合約條款
    const contractSections = [
      {
        title: '第一條　合約性質',
        content: '本合約為 合作／承攬契約，雙方並非僱傭關係，甲方不提供勞工保險、健保或其他勞動法令下之福利。乙方自行負責個人保險及稅務申報。'
      },
      {
        title: '第二條　合作內容',
        content: '乙方透過甲方平台，提供遊戲語音互動或相關娛樂服務。\n乙方可自行選擇是否接單，甲方不得強制指派工作。\n服務之方式、時間，由乙方自由決定。'
      },
      {
        title: '第三條　分潤與給付方式',
        content: '客戶支付之金額，由甲方代收，甲方依法扣除平台服務費後，將剩餘部分支付予乙方。\n分潤比例：甲方 20%，乙方 80%。\n甲方應於每月 15 日前，依實際金流紀錄結算並支付予乙方。'
      },
      {
        title: '第四條　稅務與法規遵循',
        content: '乙方應自行申報並繳納因提供服務所產生之所得稅。\n甲方得依國稅局規定，於年底開立扣繳憑單或其他合法憑證。'
      },
      {
        title: '第五條　保密與禁止行為',
        content: '乙方不得於服務過程中洩漏客戶隱私或平台機密。\n乙方不得私下與客戶進行交易，否則甲方得立即終止合作。\n乙方不得利用平台進行詐騙、色情或任何違法行為，否則須自行負責相關法律責任。'
      },
      {
        title: '第六條　合約期間與終止',
        content: '本合約自簽署日起生效，有效期間為一年，期滿自動續約。\n任一方得隨時以書面或電子通知方式終止本合約。'
      },
      {
        title: '第七條　爭議解決',
        content: '如有爭議，雙方同意以台灣台北地方法院為第一審管轄法院。'
      }
    ];
    
    // 添加合約條款
    contractSections.forEach(section => {
      // 檢查是否需要新頁面
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }
      
      doc.setFontSize(14);
      doc.setFont('NotoSansTC', 'bold');
      doc.text(section.title, margin, y);
      y += lineHeight;
      
      doc.setFontSize(12);
      doc.setFont('NotoSansTC', 'normal');
      const lines = doc.splitTextToSize(section.content, pageWidth - 2 * margin);
      lines.forEach(line => {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });
      y += lineHeight;
    });
    
    // 簽署區域
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }
    
    doc.setFontSize(14);
    doc.setFont('NotoSansTC', 'bold');
    doc.text('簽署', (pageWidth - doc.getTextWidth('簽署')) / 2, y);
    y += lineHeight * 2;
    
    doc.setFontSize(12);
    doc.setFont('NotoSansTC', 'normal');
    doc.text('甲方：昇祺科技', margin, y);
    doc.text(`乙方（簽名或電子簽名）：${userData?.name || '＿＿＿＿＿'}`, pageWidth - margin - 80, y);
    y += lineHeight * 2;
    
    doc.text('日期：＿＿年＿月＿日', pageWidth - margin - 60, y);
    
    // 下載 PDF
    doc.save(`陪玩合作承攬合約書_${userData?.name || '夥伴'}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">載入中...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pt-32">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            合作承攬合約書
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            請仔細閱讀合約內容，簽署後上傳至申請表單
          </p>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* 合約書內容 */}
          <div className="p-8">
            <div className="prose max-w-none">
              <h2 className="text-2xl font-bold text-center mb-8">陪玩合作承攬合約書</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">立約雙方：</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <div className="bg-gray-50 p-4 rounded-lg">
                     <h4 className="font-medium text-gray-900 mb-2">甲方（平台方／公司）</h4>
                     <p className="text-sm text-gray-700">公司名稱：昇祺科技</p>
                     <p className="text-sm text-gray-700">統一編號：95367956</p>
                   </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">乙方（合作夥伴）</h4>
                    <p className="text-sm text-blue-700">姓名：{userData?.name || '＿＿＿＿＿'}</p>
                    <p className="text-sm text-blue-700">身分證字號：＿＿＿＿＿</p>
                    <p className="text-sm text-blue-700">聯絡方式：{userData?.phone || '＿＿＿＿＿'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">第一條　合約性質</h3>
                  <p className="text-gray-700 leading-relaxed">
                    本合約為 <strong>合作／承攬契約</strong>，雙方並非僱傭關係，甲方不提供勞工保險、健保或其他勞動法令下之福利。乙方自行負責個人保險及稅務申報。
                  </p>
                </div>

                                 <div>
                   <h3 className="text-lg font-semibold mb-2">第二條　合作內容</h3>
                   <ul className="list-disc list-inside text-gray-700 space-y-2">
                     <li>乙方透過甲方平台，提供遊戲語音互動或相關娛樂服務。</li>
                     <li>乙方可自行選擇是否接單，甲方不得強制指派工作。</li>
                     <li>服務之方式、時間，由乙方自由決定。</li>
                   </ul>
                 </div>

                                 <div>
                   <h3 className="text-lg font-semibold mb-2">第三條　分潤與給付方式</h3>
                   <ul className="list-disc list-inside text-gray-700 space-y-2">
                     <li>客戶支付之金額，由甲方代收，甲方依法扣除平台服務費後，將剩餘部分支付予乙方。</li>
                     <li><strong>分潤比例：甲方 20%，乙方 80%。</strong></li>
                     <li>甲方應於每月 15 日前，依實際金流紀錄結算並支付予乙方。</li>
                   </ul>
                 </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">第四條　稅務與法規遵循</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>乙方應自行申報並繳納因提供服務所產生之所得稅。</li>
                    <li>甲方得依國稅局規定，於年底開立扣繳憑單或其他合法憑證。</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">第五條　保密與禁止行為</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>乙方不得於服務過程中洩漏客戶隱私或平台機密。</li>
                    <li>乙方不得私下與客戶進行交易，否則甲方得立即終止合作。</li>
                    <li>乙方不得利用平台進行詐騙、色情或任何違法行為，否則須自行負責相關法律責任。</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">第六條　合約期間與終止</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-2">
                    <li>本合約自簽署日起生效，有效期間為一年，期滿自動續約。</li>
                    <li>任一方得隨時以書面或電子通知方式終止本合約。</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">第七條　爭議解決</h3>
                  <p className="text-gray-700 leading-relaxed">
                    如有爭議，雙方同意以台灣台北地方法院為第一審管轄法院。
                  </p>
                </div>

                                 <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                   <h3 className="text-lg font-semibold mb-4 text-center">簽署</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                       <p className="text-sm text-gray-600 mb-2">甲方：昇祺科技</p>
                     </div>
                     <div>
                       <p className="text-sm text-gray-600 mb-2">乙方（簽名或電子簽名）：{userData?.name || '＿＿＿＿＿'}</p>
                     </div>
                   </div>
                   <div className="text-right mt-4">
                     <p className="text-sm text-gray-600">日期：＿＿年＿月＿日</p>
                   </div>
                 </div>
              </div>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="bg-gray-50 px-8 py-6 border-t">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={downloadContract}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                                 📥 下載 PDF 合約書
              </button>
              <a
                href="/join"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                📝 前往申請頁面
              </a>
            </div>
            
            <div className="mt-4 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      重要提醒
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        請仔細閱讀合約內容，簽署後拍照或掃描上傳至申請表單。此合約確保雙方為合作關係而非僱傭關係。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
