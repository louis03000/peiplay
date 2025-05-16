'use client'

export const dynamic = 'force-dynamic'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const partnerSchema = z.object({
  name: z.string().min(2, '姓名至少需要2個字'),
  birthday: z.string().min(1, '請選擇生日'),
  phone: z.string().min(10, '請輸入有效的電話號碼'),
  hourlyRate: z.number().min(1, '請設定每小時收費'),
  games: z.array(z.string()).min(1, '請至少選擇一個遊戲'),
  coverImage: z.string().min(1, '請上傳封面照片'),
})

type PartnerFormData = z.infer<typeof partnerSchema>

export default function JoinPage() {
  const router = useRouter()
  const sessionData = useSession();
  const session = sessionData?.data;
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

  const onSubmit = async (data: PartnerFormData) => {
    try {
      setSubmitting(true)
      setError('')
      if (!session?.user?.id) {
        setError('請先登入才能註冊夥伴')
        setSubmitting(false)
        return
      }
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          userId: session.user.id,
          coverImage: coverImageUrl,
        }),
      })
      const text = await response.text();
      let result;
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
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    姓名
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      {...register('name')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    {errors.name && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="birthday"
                    className="block text-sm font-medium text-gray-700"
                  >
                    生日
                  </label>
                  <div className="mt-1">
                    <input
                      type="date"
                      {...register('birthday')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    {errors.birthday && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.birthday.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700"
                  >
                    電話
                  </label>
                  <div className="mt-1">
                    <input
                      type="tel"
                      {...register('phone')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    {errors.phone && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="hourlyRate"
                    className="block text-sm font-medium text-gray-700"
                  >
                    每小時收費
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      {...register('hourlyRate', { valueAsNumber: true })}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    {errors.hourlyRate && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.hourlyRate.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="games"
                    className="block text-sm font-medium text-gray-700"
                  >
                    擅長遊戲
                  </label>
                  <div className="mt-1">
                    <select
                      multiple
                      {...register('games')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    >
                      <option value="lol">英雄聯盟</option>
                      <option value="valorant">特戰英豪</option>
                      <option value="apex">Apex 英雄</option>
                      <option value="csgo">CS:GO</option>
                      <option value="pubg">PUBG</option>
                    </select>
                    {errors.games && (
                      <p className="mt-2 text-sm text-red-600">
                        {errors.games.message}
                      </p>
                    )}
                  </div>
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
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                    {uploading && <span className="text-sm text-gray-500">上傳中...</span>}
                    <div className="w-32 h-32 relative">
                      <img
                        src={coverImageUrl || '/images/placeholder.svg'}
                        alt="預覽封面"
                        className="object-cover w-full h-full rounded"
                      />
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
                    disabled={submitting}
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