'use client'

export const dynamic = 'force-dynamic'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const MAX_GAMES = 10;

const partnerSchema = z.object({
  name: z.string().min(2, '姓名至少需要2個字'),
  birthday: z.string().min(1, '請選擇生日'),
  phone: z.string().min(10, '請輸入有效的電話號碼'),
  halfHourlyRate: z.number().min(1, '請設定每半小時收費'),
  games: z.array(z.string()).min(1, '請至少選擇一個遊戲').max(MAX_GAMES, '最多 10 個遊戲'),
  coverImage: z.string().min(1, '請上傳封面照片'),
  bankCode: z.string().min(1, '請填寫銀行代碼'),
  bankAccountNumber: z.string().min(1, '請填寫銀行帳號'),
  inviteCode: z.string().optional(),
})

type PartnerFormData = z.infer<typeof partnerSchema>

const GAME_OPTIONS = [
  { value: 'lol', label: '英雄聯盟' },
  { value: 'valorant', label: '特戰英豪' },
  { value: 'apex', label: 'Apex 英雄' },
  { value: 'csgo', label: 'CS:GO' },
  { value: 'pubg', label: 'PUBG' },
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
    formState: { errors },
  } = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
  })

  const [coverImageUrl, setCoverImageUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>('')
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [customGame, setCustomGame] = useState('')
  const [showGuidelines, setShowGuidelines] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [guidelinesReadTime, setGuidelinesReadTime] = useState(0)
  const [canAgree, setCanAgree] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // 載入用戶資料
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUserData(data.user);
            // 自動填入用戶資料
            setValue('name', data.user.name || '');
            setValue('birthday', data.user.birthday ? data.user.birthday.slice(0, 10) : '');
            setValue('phone', data.user.phone || '');
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
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

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">請先登入</h2>
          <p className="mb-4 text-gray-600">登入後才能申請成為遊戲夥伴</p>
          <a href="/auth/login" className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors">前往登入</a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">載入中...</h2>
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
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pt-32">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            加入我們的遊戲夥伴
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            填寫以下資料，開始您的遊戲夥伴之旅
          </p>
        </div>

        <div className="mt-12">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
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
                          此措施是為了防止洗錢等違法行為，保障平台安全。
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
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="輸入朋友的邀請碼獲得優惠"
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md text-black"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      邀請碼可以獲得額外優惠，讓朋友邀請你加入吧！
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
                    disabled={submitting || !coverImageUrl || selectedGames.length === 0}
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
    </div>
  )
} 