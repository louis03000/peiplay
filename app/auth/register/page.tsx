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
  discord: z.string().min(2, '請輸入 Discord 名稱'),
  games: z.array(z.string()).optional(),
  customGame: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '密碼不一致',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [customGame, setCustomGame] = useState('')
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
        setErrorMsg(error?.message || error?.error || '註冊失敗')
        return
      }
  
      setIsSuccess(true)
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
            <h2 className="text-2xl font-bold text-white mb-2">註冊 PeiPlay</h2>
            <p className="text-gray-400">加入我們的遊戲夥伴社群</p>
          </div>
          {isSuccess ? null : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {errorMsg && <div className="text-red-500 text-center mb-2">{errorMsg}</div>}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="Email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-400 text-sm">{errors.email.message}</p>
              )}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="密碼"
                type="password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-red-400 text-sm">{errors.password.message}</p>
              )}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="確認密碼"
                type="password"
                {...register('confirmPassword')}
              />
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
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="生日"
                type="date"
                {...register('birthday')}
              />
              {errors.birthday && (
                <p className="text-red-400 text-sm">{errors.birthday.message}</p>
              )}
              <input
                className="w-full px-4 py-2 rounded bg-gray-900 text-white placeholder-gray-400 border border-gray-700"
                placeholder="Discord 名稱"
                {...register('discord')}
              />
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