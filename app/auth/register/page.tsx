'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'

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
  role: z.enum(['CUSTOMER', 'PARTNER']),
  games: z.array(z.string()).optional(),
  customGame: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '密碼不一致',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [customGame, setCustomGame] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const role = watch('role')

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
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
        throw new Error(error.message || '註冊失敗')
      }

      // 註冊成功後跳轉到登入頁面
      window.location.href = '/auth/login'
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : '註冊失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-md mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            註冊
          </h1>
          <p className="mt-3 text-xl text-gray-300">
            加入我們，開始您的遊戲時光
          </p>
        </div>

        <div className="mt-12">
          <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-300"
                  >
                    電子郵件
                  </label>
                  <div className="mt-1">
                    <input
                      type="email"
                      {...register('email')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    />
                    {errors.email && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-300"
                  >
                    密碼
                  </label>
                  <div className="mt-1">
                    <input
                      type="password"
                      {...register('password')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    />
                    {errors.password && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-300"
                  >
                    確認密碼
                  </label>
                  <div className="mt-1">
                    <input
                      type="password"
                      {...register('confirmPassword')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    />
                    {errors.confirmPassword && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-300"
                  >
                    姓名
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      {...register('name')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    />
                    {errors.name && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="birthday"
                    className="block text-sm font-medium text-gray-300"
                  >
                    生日
                  </label>
                  <div className="mt-1">
                    <input
                      type="date"
                      {...register('birthday')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    />
                    {errors.birthday && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.birthday.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-300"
                  >
                    電話
                  </label>
                  <div className="mt-1">
                    <input
                      type="tel"
                      {...register('phone')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    />
                    {errors.phone && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-300"
                  >
                    註冊身份
                  </label>
                  <div className="mt-1">
                    <select
                      {...register('role')}
                      className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                    >
                      <option value="CUSTOMER">客人</option>
                      <option value="PARTNER">遊戲夥伴</option>
                    </select>
                    {errors.role && (
                      <p className="mt-2 text-sm text-red-400">
                        {errors.role.message}
                      </p>
                    )}
                  </div>
                </div>

                {role === 'PARTNER' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">專長遊戲（可複選）</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {GAME_OPTIONS.map((game) => (
                        <label key={game} className="flex items-center text-gray-200">
                          <input
                            type="checkbox"
                            value={game}
                            checked={selectedGames.includes(game)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedGames([...selectedGames, game])
                              } else {
                                setSelectedGames(selectedGames.filter(g => g !== game))
                              }
                            }}
                            className="mr-2 accent-indigo-500"
                          />
                          {game}
                        </label>
                      ))}
                    </div>
                    {selectedGames.includes('其他') && (
                      <input
                        type="text"
                        placeholder="請輸入其他遊戲名稱"
                        value={customGame}
                        onChange={e => setCustomGame(e.target.value)}
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 mt-2"
                      />
                    )}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '註冊中...' : '註冊'}
                  </button>
                </div>

                <div className="text-center">
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
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 