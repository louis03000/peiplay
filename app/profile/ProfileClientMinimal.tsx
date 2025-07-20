'use client'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function ProfileClientMinimal() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 如果還在載入或未掛載，顯示載入狀態
  if (status === 'loading' || !mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 頁面標題 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">會員中心</h1>
        <p className="text-gray-300">
          管理您的個人資料、預約記錄和消費紀錄
        </p>
      </div>

      {/* 個人資料區塊 */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center">
            <span className="mr-2">👤</span>
            個人資料
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            管理您的個人基本資料，這些資訊會用於服務聯繫和身份驗證
          </p>
          
          <div className="bg-gray-800/60 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><span className="block text-gray-300 mb-1">姓名</span><span className="text-white font-medium">{session?.user?.name || '-'}</span></div>
              <div><span className="block text-gray-300 mb-1">信箱</span><span className="text-white font-medium">{session?.user?.email || '-'}</span></div>
              <div><span className="block text-gray-300 mb-1">角色</span><span className="text-white font-medium">{session?.user?.role || '-'}</span></div>
              <div><span className="block text-gray-300 mb-1">狀態</span><span className="text-white font-medium">{status}</span></div>
            </div>
            <button className="w-full py-3 rounded-lg bg-indigo-500 text-white font-bold text-lg mt-6 hover:bg-indigo-600 transition">
              修改個人資料
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 