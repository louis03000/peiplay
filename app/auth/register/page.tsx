'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation';

const GAME_OPTIONS = [
  'LOL', 'APEX', '傳說對決', '爐石戰記', 'CS:GO', 'Overwatch', 'Valorant', 'Minecraft', '其他',
]

const registerSchema = z.object({
  email: z.string().email('請輸入有效的電子郵件'),
  password: z.string().min(6, '密碼至少需要6個字'),
  confirmPassword: z.string().min(6, '密碼至少需要6個字'),
  name: z.string().min(2, '姓名至少需要2個字'),
  birthday: z.string().min(1, '請選擇生日'),
  phone: z.string().min(10, '請輸入有效的電話號碼'),
  discord: z.string()
    .min(2, '請輸入 Discord 名稱')
    .regex(/^.{2,32}$/, 'Discord 用戶名長度應為 2-32 個字元'),
  games: z.array(z.string()).optional(),
  customGame: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '密碼不一致',
  path: ['confirmPassword'],
}).refine((data) => {
  const today = new Date();
  const birthDate = new Date(data.birthday);
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // 如果還沒到生日，年齡減1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 18;
  }
  
  return age >= 18;
}, {
  message: '您必須年滿18歲才能註冊',
  path: ['birthday'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errorDetails, setErrorDetails] = useState<string[]>([])
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [customGame, setCustomGame] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (isSuccess) {
      window.location.href = '/auth/login'
    }
  }, [isSuccess])

  if (status === "loading") {
    return <div className="text-center py-10">載入中...</div>;
  }

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setErrorMsg('')
    setErrorDetails([])
    try {
      let games = selectedGames.filter((g) => g !== '其他')
      if (selectedGames.includes('其他') && customGame.trim()) {
        games = [...games, customGame.trim()]
      }
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          userId: session?.user?.id,
          games,
        }),
      })
  
      if (!response.ok) {
        let error = null
        try {
          error = await response.json()
        } catch (e) {
          error = null
        }
        
        // 如果有詳細錯誤信息，顯示所有錯誤
        if (error?.details && Array.isArray(error.details) && error.details.length > 0) {
          setErrorDetails(error.details)
          setErrorMsg('密碼不符合安全要求')
        } else {
          const errorText = error?.message || error?.error || '註冊失敗'
          // 檢查是否為 Prisma 錯誤，如果是則顯示友好提示
          if (errorText.includes('recoveryCodes') || 
              errorText.includes('does not exist') ||
              errorText.includes('Invalid `prisma.user.findUnique')) {
            setErrorMsg('註冊失敗，請稍後再試')
          } else {
            setErrorMsg(errorText)
          }
          setErrorDetails([])
        }
        return
      }
  
      // 註冊成功，跳轉到 Email 驗證頁面
      const formData = await response.json()
      router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email || '')}`)
    } catch (error) {
      console.error(error)
      setErrorMsg(error instanceof Error ? error.message : '註冊失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] pt-32">
      <div className="w-full max-w-md">
        <div className="bg-[#1e293b] shadow-xl rounded-lg px-8 pt-6 pb-8 mb-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">註冊 PeiPlay</h2>
            <p className="text-gray-600 text-center">加入我們的遊戲夥伴社群</p>
          </div>
          
          {/* Discord 重要提醒 */}
          <div className="mb-6 p-4 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-indigo-200 text-center">🎮 Discord 互動平台</h3>
                <div className="mt-2 text-sm text-indigo-100">
                  <p className="mb-2">PeiPlay 使用 Discord 作為主要的互動平台，所有預約和溝通都透過 Discord 進行。</p>
                  <div className="space-y-1">
                    <p>✅ 請確保已下載並安裝 Discord</p>
                    <p>✅ 輸入您的 Discord 名稱(注意大小寫)（不需要 # 後面的數字）</p>
                    <p>✅ 註冊成功後我們會自動邀請您加入 Discord 伺服器</p>
                  </div>
                  <div className="mt-3">
                    <a 
                      href="https://discord.com/download" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      📥 下載 Discord
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isSuccess ? null : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {errorMsg && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
                  <div className="text-red-400 text-sm font-medium mb-1">{errorMsg}</div>
                  {errorDetails.length > 0 && (
                    <div className="text-red-300 text-sm space-y-1 mt-2">
                      {errorDetails.map((detail, idx) => (
                        <div key={idx}>• {detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="Email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-400 text-sm">{errors.email.message}</p>
              )}
              <div className="relative">
                <input
                  className="w-full px-4 py-2 pr-10 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                  placeholder="密碼"
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                  aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-sm">{errors.password.message}</p>
              )}
              <div className="relative">
                <input
                  className="w-full px-4 py-2 pr-10 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                  placeholder="確認密碼"
                  type={showConfirmPassword ? "text" : "password"}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
                  aria-label={showConfirmPassword ? "隱藏密碼" : "顯示密碼"}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-sm">{errors.confirmPassword.message}</p>
              )}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="姓名"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-red-400 text-sm">{errors.name.message}</p>
              )}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="電話"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-red-400 text-sm">{errors.phone.message}</p>
              )}
              <div>
                <input
                  className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                  placeholder="生日"
                  type="date"
                  {...register('birthday')}
                />
                <p className="text-gray-600 text-xs mt-1">⚠️ 必須年滿18歲才能註冊</p>
              </div>
              {errors.birthday && (
                <p className="text-red-400 text-sm">{errors.birthday.message}</p>
              )}
              <div>
                <input
                  className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                  placeholder="Discord 名稱(注意大小寫) (例如: yourusername)"
                  {...register('discord')}
                />
                <p className="text-gray-600 text-xs mt-1">
                  💡 請輸入您的 Discord 名稱(注意大小寫)，不需要 # 後面的數字
                </p>
              </div>
              {errors.discord && (
                <p className="text-red-400 text-sm">{errors.discord.message}</p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold"
              >
                {isLoading ? '註冊中...' : '註冊'}
              </button>
            </form>
          )}
          <div className="text-center mt-4">
            <p className="text-sm text-gray-300">
              已經有帳號？{' '}
              <Link
                href="/auth/login"
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                立即登入
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 