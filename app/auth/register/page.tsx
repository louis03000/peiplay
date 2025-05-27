'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
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
  role: z.string().min(1, '請選擇身份'),
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

  if (status === "unauthenticated") {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
        <div className="text-red-500 text-center mb-4">請先登入才能註冊夥伴</div>
        <a href="/auth/login" className="block text-center text-indigo-500 underline">前往登入</a>
      </div>
    );
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
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: '' },
  })

  const role = watch('role')

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
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-2xl font-bold text-green-500 mb-4">註冊成功！</div>
          <button
            className="mt-4 w-full py-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold"
            onClick={() => window.location.href = '/auth/login'}
          >
            前往登入
          </button>
        </div>
      ) : (
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
                className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-black shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
              >
                <option value="">請選擇身份</option>
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