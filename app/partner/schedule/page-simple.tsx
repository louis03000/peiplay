'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function PartnerSchedulePageSimple() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status !== "loading" && !session) {
      router.replace('/auth/login');
      return;
    }

    if (mounted && session?.user?.role !== 'PARTNER') {
      router.replace('/profile');
      return;
    }

    if (mounted && session) {
      setLoading(false);
    }
  }, [mounted, status, session, router]);

  // 如果還在載入或未掛載，顯示載入狀態
  if (status === 'loading' || !mounted || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入中...</div>
        </div>
      </div>
    );
  }

  // 如果未登入，顯示載入狀態（會自動跳轉到登入頁面）
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">重新導向到登入頁面...</div>
        </div>
      </div>
    );
  }

  // 如果不是夥伴，顯示載入狀態（會自動跳轉到個人資料頁面）
  if (session.user?.role !== 'PARTNER') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">重新導向到個人資料頁面...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 頁面標題 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">夥伴時段管理</h1>
        <p className="text-gray-300">
          管理您的服務時段和可用性設定
        </p>
      </div>

      {/* 主要內容區塊 */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">📅</span>
            時段管理
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            設定您的服務時段和可用性
          </p>
          
          <div className="bg-gray-800/60 p-6 rounded-lg">
            <div className="text-center">
              <div className="text-gray-400 text-4xl mb-3">🚧</div>
              <p className="text-gray-300 text-lg mb-2">時段管理功能正在維護中</p>
              <p className="text-gray-400 text-sm">
                為了提供更好的服務體驗，時段管理功能正在進行優化。<br />
                請稍後再試，或聯繫客服獲取協助。
              </p>
              
              <div className="mt-6">
                <button 
                  onClick={() => router.push('/profile')}
                  className="px-6 py-3 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 transition"
                >
                  返回個人資料
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 