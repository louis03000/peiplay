'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function DiscordSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const alreadyMember = searchParams.get('already_member') === 'true'

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-600 mb-4">
              {alreadyMember ? '✅ 您已經在伺服器中！' : '🎉 成功加入 Discord 伺服器！'}
            </h1>
            <p className="text-gray-600 mb-6">
              {alreadyMember 
                ? '您已經是 PeiPlay Discord 伺服器的成員了！'
                : '歡迎加入 PeiPlay Discord 伺服器！您現在可以在 Discord 中與其他成員互動了。'
              }
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 font-medium"
              >
                前往登入
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 font-medium"
              >
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
