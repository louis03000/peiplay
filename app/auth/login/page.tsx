'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-center">LINE 一鍵登入</h2>
        <button
          className="w-full py-3 mb-4 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold text-lg shadow-lg flex items-center justify-center gap-2"
          onClick={() => signIn('line')}
        >
          <img src="https://scdn.line-apps.com/n/line_regulation/files/ver2/LINE_Icon.png" alt="LINE" className="w-6 h-6" />
          使用 LINE 一鍵登入
        </button>
      </div>
    </div>
  )
} 