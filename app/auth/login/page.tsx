"use client";
import LineLoginButton from '@/components/LineLoginButton';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-8">LINE 一鍵登入</h2>
        <LineLoginButton />
        <p className="text-gray-500 text-sm mt-6">登入即表示您同意我們的服務條款和隱私政策</p>
      </div>
    </div>
  );
} 