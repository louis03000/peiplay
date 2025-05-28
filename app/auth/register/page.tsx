'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

const GAME_OPTIONS = [
  'LOL',
  'APEX',
  '傳說對決',
  '爐石戰記',
  'CS:GO',
  'Overwatch',
  'Valorant',
  'Minecraft',
  '其他',
]

const registerSchema = z.object({
  email: z.string().email('請輸入有效的電子郵件'),
  password: z.string().min(6, '密碼至少需要6個字'),
  confirmPassword: z.string().min(6, '密碼至少需要6個字'),
  name: z.string().min(2, '姓名至少需要2個字'),
  birthday: z.string().min(1, '請選擇生日'),
  phone: z.string().min(10, '請輸入有效的電話號碼'),
  games: z.array(z.string()).optional(),
  customGame: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '密碼不一致',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="text-center py-10">載入中...</div>;
  }

  if (status === "authenticated") {
    if (typeof window !== "undefined") window.location.href = "/";
    return null;
  }

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
    if (isSuccess) {
      window.location.href = '/auth/login'
    }
  }, [isSuccess])

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      let games = selectedGames.filter((g) => g !== '其他')
      if (selectedGames.includes('其他') && customGame.trim()) {
        games = [...games, customGame.trim()]
      }
      const submitData = { ...data, games }
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const error = await response.json()
        setErrorMsg(error.message || '註冊失敗')
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
    <div className="max-w-md mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">註冊</h2>
      {isSuccess ? null : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <pre>{JSON.stringify(errors, null, 2)}</pre>
          {errorMsg && <div className="text-red-500 text-center mb-2">{errorMsg}</div>}
          <input
            className="w-full px-4 py-2 rounded bg-gray-900 text-black placeholder-gray-500 border border-gray-700"
            placeholder="Email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-red-400 text-sm">{errors.email.message}</p>
          )}
          <input
            className="w-full px-4 py-2 rounded bg-gray-900 text-black placeholder-gray-500 border border-gray-700"
            placeholder="密碼"
            type="password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-red-400 text-sm">{errors.password.message}</p>
          )}
          <input
            className="w-full px-4 py-2 rounded bg-gray-900 text-black placeholder-gray-500 border border-gray-700"
            placeholder="確認密碼"
            type="password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-red-400 text-sm">{errors.confirmPassword.message}</p>
          )}
          <input
            className="w-full px-4 py-2 rounded bg-gray-900 text-black placeholder-gray-500 border border-gray-700"
            placeholder="姓名"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-red-400 text-sm">{errors.name.message}</p>
          )}
          <input
            className="w-full px-4 py-2 rounded bg-gray-900 text-black placeholder-gray-500 border border-gray-700"
            placeholder="電話"
            {...register('phone')}
          />
          {errors.phone && (
            <p className="text-red-400 text-sm">{errors.phone.message}</p>
          )}
          <input
            className="w-full px-4 py-2 rounded bg-gray-900 text-black placeholder-gray-500 border border-gray-700"
            placeholder="生日"
            type="date"
            {...register('birthday')}
          />
          {errors.birthday && (
            <p className="text-red-400 text-sm">{errors.birthday.message}</p>
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
  )
} 