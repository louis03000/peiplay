'use client'

export const dynamic = 'force-dynamic'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

const MAX_GAMES = 10;

const partnerSchema = z.object({
  name: z.string().min(2, '名字至少需要2個字'),
  birthday: z.string().min(1, '請選擇生日'),
  phone: z.string().min(10, '請輸入有效的電話號碼'),
  gender: z.string().min(1, '請選擇性別'),
  interests: z.array(z.string()).min(1, '請至少選擇一個興趣').max(5, '最多 5 個興趣'),
  halfHourlyRate: z.number().min(1, '請設定每半小時收費'),
  games: z.array(z.string()).min(1, '請至少選擇一個遊戲').max(MAX_GAMES, '最多 10 個遊戲'),
  supportsChatOnly: z.boolean().optional(),
  chatOnlyRate: z.number().optional(),
  coverImage: z.string().min(1, '請上傳封面照片'),
  idVerificationPhoto: z.string().min(1, '請上傳身分證自拍'),
  bankCode: z.string().min(1, '請填寫銀行代碼'),
  bankAccountNumber: z.string().min(1, '請填寫銀行帳號'),
  inviteCode: z.string().optional(),
  contractFile: z.string().min(1, '請上傳已簽署的合作承攬合約書'),
})

type PartnerFormData = z.infer<typeof partnerSchema>

const GAME_OPTIONS = [
  { value: 'lol', label: '英雄聯盟' },
  { value: 'valorant', label: '特戰英豪' },
  { value: 'apex', label: 'Apex 英雄' },
  { value: 'csgo', label: 'CS:GO' },
  { value: 'pubg', label: 'PUBG' },
  { value: 'chat', label: '純聊天' },
]

const INTEREST_OPTIONS = [
  { value: 'gaming', label: '遊戲' },
  { value: 'music', label: '音樂' },
  { value: 'movies', label: '電影' },
  { value: 'sports', label: '運動' },
  { value: 'travel', label: '旅遊' },
  { value: 'food', label: '美食' },
  { value: 'art', label: '藝術' },
  { value: 'technology', label: '科技' },
  { value: 'books', label: '閱讀' },
  { value: 'photography', label: '攝影' },
]

const GENDER_OPTIONS = [
  { value: 'male', label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'other', label: '其他' },
]

export default function JoinPage() {
  const router = useRouter()
  const sessionData = useSession();
  const session = sessionData?.data;
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
  })

  const [coverImageUrl, setCoverImageUrl] = useState<string>('')
  const [contractFileUrl, setContractFileUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadingContract, setUploadingContract] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [customGame, setCustomGame] = useState('')
  const [showGuidelines, setShowGuidelines] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteCodeValid, setInviteCodeValid] = useState<boolean | null>(null)
  const [validatingInviteCode, setValidatingInviteCode] = useState(false)
  const [inviteCodeMessage, setInviteCodeMessage] = useState('')
  const [guidelinesReadTime, setGuidelinesReadTime] = useState(0)
  const [canAgree, setCanAgree] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [idVerificationPhoto, setIdVerificationPhoto] = useState<string>('')
  const [partnerRejectionCount, setPartnerRejectionCount] = useState(0)
  const [isRejectedTooManyTimes, setIsRejectedTooManyTimes] = useState(false)

  // 載入用戶資料和拒絕次數
  useEffect(() => {
    if (session?.user?.id) {
      // 載入用戶資料
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUserData(data.user);
            // 自動填入用戶資料
            setValue('name', data.user.name || '');
            setValue('birthday', data.user.birthday ? data.user.birthday.slice(0, 10) : '');
            setValue('phone', data.user.phone || '');
            
            // 檢查是否已有已通過的夥伴身份（只有 APPROVED 狀態才需要阻止申請）
            if (data.user.partner && data.user.partner.status === 'APPROVED') {
              setError('您已經有夥伴身份了！如需修改資料，請前往個人資料頁面。');
              setLoading(false);
              return;
            }
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
      
      // 檢查拒絕次數
      fetch('/api/partners/self')
        .then(res => res.json())
        .then(data => {
          const rejectionCount = data?.partnerRejectionCount || 0
          setPartnerRejectionCount(rejectionCount)
          if (rejectionCount >= 3) {
            setIsRejectedTooManyTimes(true)
          }
        })
        .catch(() => {
          // 忽略錯誤，繼續顯示表單
        });
    }
  }, [session, setValue]);

  useEffect(() => {
    setValue('games', selectedGames, { shouldValidate: true });
  }, [selectedGames, setValue]);

  // 處理規範閱讀倒計時
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (showGuidelines && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
        if (countdown - 1 === 0) {
          setCanAgree(true);
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showGuidelines, countdown]);

  // 當用戶點擊查看規範時開始倒計時
  const handleShowGuidelines = () => {
    if (!showGuidelines) {
      setShowGuidelines(true);
      setCountdown(10);
      setCanAgree(false);
    } else {
      setShowGuidelines(false);
      setCountdown(0);
      setCanAgree(false);
    }
  };

  // 驗證邀請碼
  const validateInviteCode = async (code: string) => {
    if (!code.trim()) {
      setInviteCodeValid(null)
      setInviteCodeMessage('')
      return
    }

    setValidatingInviteCode(true)
    try {
      const response = await fetch('/api/partners/referral/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: code.trim() }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setInviteCodeValid(true)
        setInviteCodeMessage(`✅ 邀請碼有效！來自夥伴：${result.inviter.name}`)
      } else {
        setInviteCodeValid(false)
        setInviteCodeMessage(`❌ ${result.error}`)
      }
    } catch (error) {
      setInviteCodeValid(false)
      setInviteCodeMessage('❌ 驗證邀請碼時發生錯誤')
    } finally {
      setValidatingInviteCode(false)
    }
  }

  const handleInviteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInviteCode(value)
    
    // 延遲驗證，避免過於頻繁的請求
    if (value.trim()) {
      const timeoutId = setTimeout(() => {
        validateInviteCode(value)
      }, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setInviteCodeValid(null)
      setInviteCodeMessage('')
    }
  }

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
       lines.forEach((line: string) => {
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

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">請先登入</h2>
          <p className="mb-4 text-gray-600 text-center">登入後才能申請成為遊戲夥伴</p>
          <a href="/auth/login" className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors">前往登入</a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">載入中...</h2>
        </div>
      </div>
    )
  }

  if (isRejectedTooManyTimes) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold mb-4 text-gray-800">無法再次申請</h2>
          <p className="mb-4 text-gray-600">
            很抱歉，您的夥伴申請已被拒絕 {partnerRejectionCount} 次。
          </p>
          <p className="mb-6 text-gray-600">
            根據平台規定，每位用戶最多只能申請3次。如果您有任何疑問，請聯繫客服。
          </p>
          <Link 
            href="/" 
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors"
          >
            返回首頁
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: PartnerFormData) => {
    try {
      setSubmitting(true)
      setError('')
      let games = selectedGames.filter(g => g !== 'other')
      if (selectedGames.includes('other') && customGame.trim()) {
        games = [...games, customGame.trim()]
      }
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          userId: session!.user!.id,
          email: session!.user!.email,
          coverImage: coverImageUrl,
          contractFile: contractFileUrl,
          games,
          halfHourlyRate: data.halfHourlyRate,
          bankCode: data.bankCode,
          bankAccountNumber: data.bankAccountNumber,
          inviteCode: inviteCode.trim() || undefined,
        }),
      })
      const text = await response.text();
      let result;
      if (!text) {
        throw new Error('API 無回應，請稍後再試')
      }
      try {
        result = JSON.parse(text);
      } catch {
        result = text;
      }
      if (!response.ok) {
        throw new Error(result?.error || result || '註冊失敗')
      }
      // 申請成功，顯示等待審核畫面
      setApplicationSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 檢查檔案大小 (限制為 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('封面圖片大小不能超過 5MB，請壓縮圖片後重新上傳')
      return
    }
    
    setUploading(true)
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || '上傳失敗')
      }
      
      if (result.url) {
        setCoverImageUrl(result.url)
        setValue('coverImage', result.url, { shouldValidate: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  const handleContractFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 檢查檔案大小 (限制為 8MB)
    const maxSize = 8 * 1024 * 1024; // 8MB
    if (file.size > maxSize) {
      setError('檔案大小不能超過 8MB，請壓縮檔案後重新上傳')
      return
    }
    
    setUploadingContract(true)
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || '上傳失敗')
      }
      
      if (result.url) {
        setContractFileUrl(result.url)
        setValue('contractFile', result.url, { shouldValidate: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploadingContract(false)
    }
  }

  const handleIdVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 檢查檔案大小 (限制為 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('身分證照片大小不能超過 10MB，請壓縮圖片後重新上傳')
      return
    }
    
    // 檢查檔案類型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setError('請上傳 JPG、PNG 或 PDF 格式的檔案')
      return
    }
    
    setUploading(true)
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      
      if (!res.ok) {
        throw new Error(result.error || '上傳失敗')
      }
      
      if (result.url) {
        setIdVerificationPhoto(result.url)
        setValue('idVerificationPhoto', result.url, { shouldValidate: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  // 如果申請已提交，顯示等待審核畫面
  if (applicationSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
          {/* 成功圖標 */}
          <div className="text-center mb-8">
            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
              🎉 申請已成功提交！
            </h1>
            <p className="text-lg text-gray-600 text-center">
              感謝您申請成為 PeiPlay 的遊戲夥伴
            </p>
          </div>

          {/* 等待審核說明 */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              審核流程說明
            </h2>
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</span>
                <p>我們的審核團隊將仔細審查您提交的資料</p>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                <p>審核通常需要 1-3 個工作天</p>
              </div>
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</span>
                <p>審核結果將通過 Email 和站內通知發送給您</p>
              </div>
            </div>
          </div>

          {/* 溫馨提示 */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              溫馨提醒
            </h3>
            <ul className="space-y-2 text-sm text-yellow-800">
              <li>• 請保持您的 Email 和 Discord 暢通，以便我們聯繫您</li>
              <li>• 審核期間請勿重複提交申請</li>
              <li>• 如有任何問題，請聯繫客服團隊</li>
            </ul>
          </div>

          {/* 返回按鈕 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              返回首頁
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="flex-1 bg-white text-gray-700 py-4 px-6 rounded-xl font-semibold text-lg border-2 border-gray-300 hover:bg-gray-50 transform hover:scale-105 transition-all duration-200"
            >
              查看個人資料
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg px-8 pt-6 pb-8 mb-4 border border-gray-200 max-w-4xl mx-auto text-center w-full">
          <h1 className="text-3xl font-bold text-black mb-6 text-center" style={{color: 'black'}}>
            加入我們的遊戲夥伴
          </h1>
          <p className="text-lg text-black mb-8 text-center" style={{color: 'black'}}>
            填寫以下資料，開始您的遊戲夥伴之旅
          </p>

          <div className="text-left">
              {error && (
                <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* 顯示用戶基本資料（唯讀） */}
                {userData && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">您的個人資料</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">姓名</label>
                        <div className="mt-1 text-sm text-gray-900">{userData.name}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">生日</label>
                        <div className="mt-1 text-sm text-gray-900">{userData.birthday ? userData.birthday.slice(0, 10) : '-'}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">電話</label>
                        <div className="mt-1 text-sm text-gray-900">{userData.phone || '-'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 隱藏的欄位，用於表單驗證 */}
                <input type="hidden" {...register('name')} value={userData?.name || ''} />
                <input type="hidden" {...register('birthday')} value={userData?.birthday ? userData.birthday.slice(0, 10) : ''} />
                <input type="hidden" {...register('phone')} value={userData?.phone || ''} />

                {/* 合作承攬合約書 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-blue-900 mb-4">📋 合作承攬合約書</h3>
                  <div className="space-y-4">
                                         <div className="bg-white p-4 rounded-lg border border-blue-300">
                       <h4 className="font-medium text-blue-800 mb-2">步驟 1：下載合約書</h4>
                       <p className="text-sm text-blue-700 mb-3">
                         請先下載合作承攬合約書，仔細閱讀後簽署。此合約確保雙方為合作關係而非僱傭關係。
                       </p>
                       <div className="flex flex-col sm:flex-row gap-2">
                         <button
                           type="button"
                           onClick={downloadContract}
                           className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                         >
                                                       📥 下載 PDF 合約書
                         </button>
                         <a
                           href="/contract"
                           target="_blank"
                           className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                         >
                           📄 查看完整合約書
                         </a>
                       </div>
                     </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-blue-300">
                      <h4 className="font-medium text-blue-800 mb-2">步驟 2：上傳已簽署的合約書</h4>
                      <p className="text-sm text-blue-700 mb-3">
                        請將已簽署的合作承攬合約書拍照或掃描後上傳（支援 JPG、PNG、PDF 格式）
                      </p>
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={handleContractFileChange}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {uploadingContract && <span className="text-sm text-gray-500">上傳中...</span>}
                        {contractFileUrl && (
                          <div className="flex items-center space-x-2">
                            <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-green-600">合約書上傳成功</span>
                          </div>
                        )}
                        {errors.contractFile && (
                          <p className="text-sm text-red-600">{errors.contractFile.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="halfHourlyRate"
                    className="block text-sm font-medium text-gray-700"
                  >
                    每半小時收費
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      {...register('halfHourlyRate', { valueAsNumber: true })}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                    />
                    {errors.halfHourlyRate && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.halfHourlyRate.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* 性別選擇 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">性別</label>
                  <div className="mt-1">
                    <select
                      {...register('gender')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                    >
                      <option value="">請選擇性別</option>
                      {GENDER_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.gender && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.gender.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* 興趣選擇 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">興趣 (最多選擇5個)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {INTEREST_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center text-gray-800">
                        <input
                          type="checkbox"
                          value={opt.value}
                          {...register('interests')}
                          className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.interests && (
                    <p className="mt-2 text-sm text-red-600">
                      {errors.interests.message}
                    </p>
                  )}
                </div>

                {/* 純聊天服務 */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-green-900 mb-4">💬 純聊天服務</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('supportsChatOnly')}
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      />
                      <label className="ml-2 text-sm font-medium text-gray-700">
                        我願意提供純聊天服務
                      </label>
                    </div>
                    
                    {watch('supportsChatOnly') && (
                      <div>
                        <label
                          htmlFor="chatOnlyRate"
                          className="block text-sm font-medium text-gray-700"
                        >
                          純聊天每半小時收費
                        </label>
                        <div className="mt-1">
                          <input
                            type="number"
                            {...register('chatOnlyRate', { valueAsNumber: true })}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                            placeholder="請設定純聊天每半小時收費"
                          />
                          {errors.chatOnlyRate && (
                            <p className="mt-2 text-sm text-red-600">
                              {errors.chatOnlyRate.message}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 身分證自拍 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-yellow-900 mb-4">🆔 身分驗證</h3>
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-yellow-300">
                      <h4 className="font-medium text-yellow-800 mb-2">手持身分證自拍</h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        請手持身分證進行自拍，確保身分證上的文字清晰可見。此照片僅用於身分驗證，不會公開顯示。
                      </p>
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleIdVerificationUpload}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-100 file:text-yellow-700 hover:file:bg-yellow-200"
                        />
                        {idVerificationPhoto && (
                          <div className="mt-2">
                            <img
                              src={idVerificationPhoto}
                              alt="身分證自拍預覽"
                              className="h-32 w-auto rounded-lg border border-gray-300"
                            />
                            <p className="text-xs text-gray-500 mt-1">預覽</p>
                          </div>
                        )}
                        <input type="hidden" {...register('idVerificationPhoto')} value={idVerificationPhoto || ''} />
                        {errors.idVerificationPhoto && (
                          <p className="text-sm text-red-600">
                            {errors.idVerificationPhoto.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">偏好遊戲</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {GAME_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center text-gray-800">
                        <input
                          type="checkbox"
                          value={opt.value}
                          checked={selectedGames.includes(opt.value)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedGames([...selectedGames, opt.value])
                            } else {
                              setSelectedGames(selectedGames.filter(g => g !== opt.value))
                            }
                          }}
                          className="mr-2 accent-indigo-500"
                        />
                        {opt.label}
                      </label>
                    ))}
                    <label className="flex items-center text-gray-800">
                      <input
                        type="checkbox"
                        value="other"
                        checked={selectedGames.includes('other')}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedGames([...selectedGames, 'other'])
                          } else {
                            setSelectedGames(selectedGames.filter(g => g !== 'other'))
                            setCustomGame('')
                          }
                        }}
                        className="mr-2 accent-indigo-500"
                      />
                      其他
                    </label>
                  </div>
                  {selectedGames.includes('other') && (
                    <input
                      type="text"
                      placeholder="請輸入其他遊戲名稱"
                      value={customGame}
                      onChange={e => setCustomGame(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-black shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 mt-2"
                    />
                  )}
                  {errors.games && (
                    <p className="mt-2 text-sm text-red-600">{errors.games.message}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="coverImage"
                    className="block text-sm font-medium text-gray-700"
                  >
                    封面照片
                  </label>
                  <div className="mt-1 flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                    />
                    {uploading && <span className="text-sm text-gray-500">上傳中...</span>}
                    <div className="w-32 h-32 relative">
                      {coverImageUrl ? (
                        <img
                          src={coverImageUrl}
                          alt="預覽封面"
                          className="object-cover w-full h-full rounded"
                        />
                      ) : (
                        <img
                          src={'/images/placeholder.svg'}
                          alt="預覽封面"
                          className="object-cover w-full h-full rounded"
                        />
                      )}
                    </div>
                    {errors.coverImage && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.coverImage.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="bankCode"
                      className="block text-sm font-medium text-gray-700"
                    >
                      銀行代碼
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        {...register('bankCode')}
                        placeholder="請填寫銀行代碼（例：123）"
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                      />
                      {errors.bankCode && (
                        <p className="mt-2 text-sm text-red-600">
                          {errors.bankCode.message}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label
                      htmlFor="bankAccountNumber"
                      className="block text-sm font-medium text-gray-700"
                    >
                      銀行帳號
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        {...register('bankAccountNumber')}
                        placeholder="請填寫銀行帳號（例：4567890123456）"
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                      />
                      {errors.bankAccountNumber && (
                        <p className="mt-2 text-sm text-red-600">
                          {errors.bankAccountNumber.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
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
                          銀行帳戶資訊提交後將無法更改，請務必確認資訊正確無誤。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="inviteCode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    邀請碼（選填）
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={handleInviteCodeChange}
                      placeholder="輸入朋友的邀請碼獲得優惠"
                      className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black ${
                        inviteCodeValid === true ? 'border-green-500' : 
                        inviteCodeValid === false ? 'border-red-500' : ''
                      }`}
                    />
                    {validatingInviteCode && (
                      <p className="mt-1 text-xs text-blue-500">
                        🔍 驗證中...
                      </p>
                    )}
                    {inviteCodeMessage && (
                      <p className={`mt-1 text-xs ${
                        inviteCodeValid ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {inviteCodeMessage}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      使用邀請碼加入，您的邀請人將根據推薦人數獲得階梯式推薦獎勵！
                    </p>
                  </div>
                </div>

                {/* 夥伴規範 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-blue-900">📘 Peiplay 夥伴使用規範</h3>
                    <button
                      type="button"
                      onClick={handleShowGuidelines}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {showGuidelines ? '收起規範' : '查看完整規範'}
                    </button>
                  </div>
                  
                  {showGuidelines && countdown > 0 && (
                    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                        <span className="text-yellow-800 font-medium">
                          請仔細閱讀規範，{countdown} 秒後才能同意
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {showGuidelines && (
                    <div className="text-sm text-blue-800 space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">✅ 一、基本行為規範</h4>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>不得提供任何超出平台列明之服務項目</li>
                          <li>不得引導客戶至平台以外進行交易或私下聯絡</li>
                          <li>不得散播不實言論或抹平台形象</li>
                          <li>不得擅自承諾或提供非平台允許之優惠、時數或贈品</li>
                          <li>不得冒用他人身份或使用虛假資料註冊</li>
                          <li>不得與顧客發展曖昧、親密或私密性質之互動</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">🔧 二、接單與服務規範</h4>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>接單後需準時上線，遲到超過 10 分鐘視為違規一次</li>
                          <li>無正當理由連續缺席 2 次以上，平台將自動暫停接單權限</li>
                          <li>如需請假或暫停服務，請於預約時間前 3 小時通知平台與顧客</li>
                          <li>服務時須保持禮貌、耐心、專業，不得與顧客爭執或情緒失控</li>
                          <li>服務中不得從事長時間靜音、無回應或離席等行為</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">🔒 三、資訊與隱私規範</h4>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>不得洩露顧客個資（如姓名、照片、聯絡方式等）</li>
                          <li>平台提供的帳號、後台資訊不得外流或借用他人使用</li>
                          <li>不得擅自拍攝、錄音、錄影或截圖顧客對話內容公開分享</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">🚨 四、違規處理與懲處機制</h4>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>輕度：口頭或書面警告一次</li>
                          <li>中度：暫停接單 7 天，需教育後復權</li>
                          <li>嚴重：永久停權，無法再登錄或重新註冊</li>
                        </ul>
                      </div>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-yellow-800 text-xs">
                          📌 提醒：此規範目的為維護所有誠實、認真服務的夥伴，也保護顧客不受傷害。
                          若有疑慮、申訴或建議，歡迎聯繫管理團隊。
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      id="agreeGuidelines"
                      required
                      disabled={!canAgree}
                      className={`mr-2 accent-blue-500 ${!canAgree ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <label 
                      htmlFor="agreeGuidelines" 
                      className={`text-sm ${!canAgree ? 'text-gray-500' : 'text-blue-800'}`}
                    >
                      我已詳閱並同意遵守 Peiplay 夥伴使用規範
                      {!canAgree && showGuidelines && (
                        <span className="ml-2 text-xs text-yellow-600">
                          (請等待 {countdown} 秒)
                        </span>
                      )}
                    </label>
                    <a
                      href="/guidelines"
                      target="_blank"
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      查看完整規範
                    </a>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !coverImageUrl || !contractFileUrl || selectedGames.length === 0 || !canAgree}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? '提交中...' : '提交申請'}
                  </button>
                </div>
              </form>
          </div>
        </div>
      </div>
    </div>
  )
} 