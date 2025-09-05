'use client'

import { useState } from 'react'

export default function AddCoinsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const addCoins = async (amount: number) => {
    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/admin/add-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coinAmount: amount }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ 成功添加 ${amount} 金幣！當前餘額：${data.coinBalance} 金幣`)
      } else {
        setMessage(`❌ 添加失敗：${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ 請求失敗：${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-32">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">🪙 添加測試金幣</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">快速添加金幣</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => addCoins(1000)}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? '處理中...' : '添加 1000 金幣'}
            </button>
            
            <button
              onClick={() => addCoins(5000)}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? '處理中...' : '添加 5000 金幣'}
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${
              message.includes('✅') ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'
            }`}>
              {message}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">使用說明</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• 點擊按鈕即可添加對應數量的金幣</li>
            <li>• 金幣會立即到帳，可用於測試預約功能</li>
            <li>• 這是測試功能，僅用於開發環境</li>
            <li>• 添加後請重新整理頁面查看最新餘額</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
