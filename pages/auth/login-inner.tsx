import { signIn, useSession } from 'next-auth/react'
import LineLoginButton from '../../components/LineLoginButton'

export default function LoginPage() {
  const { data: session, status } = useSession();
  console.log('session', session, 'status', status);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-center text-black">LINE 一鍵登入</h2>
        <LineLoginButton />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          登入即表示您同意我們的服務條款和隱私政策
        </p>
      </div>
    </div>
  )
} 