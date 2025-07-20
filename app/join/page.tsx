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
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            加入我們的遊戲夥伴
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            填寫以下資料，開始您的陪玩之旅
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