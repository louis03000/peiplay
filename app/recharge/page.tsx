"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function RechargePage() {
  const [selectedAmount, setSelectedAmount] = useState(100)
  const [loading, setLoading] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (!session) {
      router.push('/auth/signin')
    }
  }, [session, router])

  const handleRecharge = async () => {
    if (!session?.user?.id) {
      alert('請先登入')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinAmount: selectedAmount,
          paymentMethod: 'ecpay'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        // 跳轉到付款頁面
        window.location.href = data.paymentUrl
      } else {
        const errorData = await response.json()
        alert(errorData.error || '儲值失敗')
      }
    } catch (error) {
      console.error('儲值失敗:', error)
      alert('儲值失敗，請重試')
    } finally {
      setLoading(false)
    }
  }
  
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>載入中...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="max-w-4xl mx-auto py-8 px-4 pt-32">
        <h1 className="text-4xl font-bold mb-8 text-center">🪙 商店</h1>
        
        {/* 功能選擇 */}
        <div className="flex justify-center gap-4 mb-8">
          <button 
            onClick={() => window.location.href = '/recharge'}
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition-colors"
          >
            💰 儲值購金幣
          </button>
          <button 
            onClick={() => window.location.href = '/gifts'}
            className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg transition-colors"
          >
            🎁 送禮物
          </button>
        </div>
        
        <h2 className="text-2xl font-bold mb-6 text-center">儲值購金幣</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[
            { coins: 100, bonus: 0, popular: false },
            { coins: 500, bonus: 50, popular: false },
            { coins: 1000, bonus: 150, popular: true },
            { coins: 2000, bonus: 400, popular: false },
            { coins: 5000, bonus: 1200, popular: false },
            { coins: 10000, bonus: 3000, popular: false }
          ].map((package_) => (
            <div
              key={package_.coins}
              className={`p-6 border-2 rounded-lg cursor-pointer transition-all relative ${
                selectedAmount === package_.coins
                  ? 'border-yellow-400 bg-yellow-400/10'
                  : 'border-gray-600 hover:border-gray-400'
              } ${package_.popular ? 'ring-2 ring-yellow-400' : ''}`}
              onClick={() => setSelectedAmount(package_.coins)}
            >
              {package_.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold">
                    最熱門
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">
                  {package_.coins + package_.bonus}
                </div>
                <div className="text-gray-400 mb-2">金幣</div>
                <div className="text-lg font-semibold text-green-400 mb-2">
                  NT$ {package_.coins}
                </div>
                {package_.bonus > 0 && (
                  <div className="text-sm text-yellow-400">
                    +{package_.bonus} 贈送金幣
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  1金幣 = 1元台幣
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center mb-8">
          <button
            onClick={handleRecharge}
            disabled={loading}
            className="bg-yellow-500 text-black px-12 py-4 rounded-lg text-xl font-bold hover:bg-yellow-400 disabled:opacity-50 transition-all"
          >
            {loading ? '處理中...' : `確認儲值 ${selectedAmount} 金幣`}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-600">
            <h3 className="text-xl font-semibold mb-4 text-yellow-400">💡 金幣用途</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-center">
                <span className="text-green-400 mr-2">✓</span>
                預約遊戲夥伴服務
              </li>
              <li className="flex items-center">
                <span className="text-green-400 mr-2">✓</span>
                贈送禮物給夥伴
              </li>
              <li className="flex items-center">
                <span className="text-green-400 mr-2">✓</span>
                參與平台活動
              </li>
              <li className="flex items-center">
                <span className="text-green-400 mr-2">✓</span>
                兌換特殊權限
              </li>
            </ul>
          </div>
          
          <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-600">
            <h3 className="text-xl font-semibold mb-4 text-yellow-400">💰 儲值說明</h3>
            <ul className="space-y-3 text-gray-300">
              <li>• 1 金幣 = 1 元新台幣</li>
              <li>• 金幣一經儲值，恕不退費</li>
              <li>• 大量儲值可獲得贈送金幣</li>
              <li>• 支援信用卡、超商付款</li>
              <li>• 付款成功後立即到帳</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
