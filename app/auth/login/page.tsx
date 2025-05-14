'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('請輸入有效的電子郵件'),
  password: z.string().min(6, '密碼至少需要6個字'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      // TODO: 實現登入邏輯
      console.log(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">登入</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="email"
          {...register('email')}
          className="w-full px-4 py-2 rounded bg-gray-900 text-white border border-gray-700"
          placeholder="Email"
        />
        <input
          type="password"
          {...register('password')}
          className="w-full px-4 py-2 rounded bg-gray-900 text-white border border-gray-700"
          placeholder="密碼"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold"
        >
          {isLoading ? '登入中...' : '登入'}
        </button>
      </form>
      <div className="text-center mt-4">
        <p className="text-sm text-gray-300">
          還沒有帳號？{' '}
          <Link
            href="/auth/register"
            className="font-medium text-indigo-400 hover:text-indigo-300"
          >
            立即註冊
          </Link>
        </p>
      </div>
    </div>
  )
} 