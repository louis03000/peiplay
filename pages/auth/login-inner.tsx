import React from 'react'

export default function LoginPage() {
  // 只在瀏覽器端渲染 useSession，SSR/SSG 直接回傳 null
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-center text-black">LINE 一鍵登入</h2>
        <p className="mt-4 text-sm text-gray-500">
          登入即表示您同意我們的服務條款和隱私政策
        </p>
      </div>
    </div>
  )
} 