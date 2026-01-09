'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function DiscordErrorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'access_denied':
        return '您取消了 Discord 授權'
      case 'missing_params':
        return '缺少必要的參數'
      case 'config_missing':
        return 'Discord 配置缺失，請聯繫管理員'
      case 'token_failed':
        return '獲取 Discord 授權失敗，請重試'
      case 'no_token':
        return '未獲取到授權令牌'
      case 'user_info_failed':
        return '獲取 Discord 用戶資訊失敗'
      case 'join_failed':
        return '加入 Discord 伺服器失敗，請聯繫管理員'
      default:
        return '加入 Discord 伺服器時發生錯誤，請稍後再試'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-4">❌ 加入失敗</h1>
            <p className="text-gray-600 mb-6">
              {getErrorMessage(error)}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium"
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
