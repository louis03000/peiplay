'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Gift {
  id: string
  name: string
  emoji: string
  coinCost: number
  partnerShare: number
  description: string
}

interface User {
  id: string
  name: string
  email: string
}

export default function TestGiftsPage() {
  const { data: session } = useSession()
  const [gifts, setGifts] = useState<Gift[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // 使用新的測試API
      const response = await fetch('/api/test-gifts')
      const data = await response.json()
      if (data.success) {
        setGifts(data.gifts)
        setUsers(data.users)
      } else {
        setMessage('❌ 獲取數據失敗: ' + data.error)
      }
    } catch (error) {
      console.error('獲取數據失敗:', error)
      setMessage('❌ 獲取數據失敗: ' + error)
    } finally {
      setLoading(false)
    }
  }

  const sendGift = async () => {
    if (!selectedGift || !selectedUser) {
      setMessage('❌ 請選擇禮物和接收者')
      return
    }

    setSending(true)
    setMessage('')

    try {
      const response = await fetch('/api/test-gifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          giftName: selectedGift.name
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ 成功贈送 ${selectedGift.emoji} ${selectedGift.name} 給 ${selectedUser.name}！`)
        setSelectedGift(null)
        setSelectedUser(null)
      } else {
        setMessage(`❌ 贈送失敗：${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ 贈送失敗：${error}`)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-32">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="text-center">載入中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-32">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">🎁 測試送禮物功能</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 選擇禮物 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">選擇禮物</h2>
            <div className="grid grid-cols-2 gap-4">
              {gifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift)}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedGift?.id === gift.id
                      ? 'border-yellow-500 bg-yellow-500/20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-2">{gift.emoji}</div>
                  <div className="font-semibold">{gift.name}</div>
                  <div className="text-sm text-gray-400">{gift.coinCost} 金幣</div>
                </button>
              ))}
            </div>
          </div>

          {/* 選擇接收者 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">選擇接收者</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                    selectedUser?.id === user.id
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="font-semibold">{user.name || '未設定'}</div>
                  <div className="text-sm text-gray-400">{user.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 送禮物按鈕 */}
        <div className="mt-8 text-center">
          <button
            onClick={sendGift}
            disabled={!selectedGift || !selectedUser || sending}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '送禮物中...' : '🎁 送禮物'}
          </button>
        </div>

        {/* 訊息顯示 */}
        {message && (
          <div className={`mt-6 p-4 rounded-lg text-center ${
            message.includes('✅') ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'
          }`}>
            {message}
          </div>
        )}

        {/* 使用說明 */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">使用說明</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• 選擇一個禮物和接收者</li>
            <li>• 點擊「送禮物」按鈕</li>
            <li>• 系統會扣除您的金幣並增加接收者的收益</li>
            <li>• 這是測試功能，用於驗證送禮物系統</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
