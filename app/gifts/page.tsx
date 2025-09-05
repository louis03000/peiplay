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

export default function GiftsPage() {
  const { data: session } = useSession()
  const [gifts, setGifts] = useState<Gift[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userCoins, setUserCoins] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // 獲取禮物列表
      const giftsResponse = await fetch('/api/gifts/list')
      const giftsData = await giftsResponse.json()
      if (giftsData.success) {
        setGifts(giftsData.gifts)
      }

      // 獲取用戶金幣餘額
      const coinsResponse = await fetch('/api/user/coins')
      const coinsData = await coinsResponse.json()
      if (coinsData.success) {
        setUserCoins(coinsData.coinBalance)
      }

      // 獲取用戶列表
      const usersResponse = await fetch('/api/admin/users')
      const usersData = await usersResponse.json()
      if (usersData.success) {
        setUsers(usersData.users.filter((user: any) => user.id !== session?.user?.id))
      }
    } catch (error) {
      console.error('獲取數據失敗:', error)
      setMessage('❌ 獲取數據失敗，請檢查網路連線')
    } finally {
      setLoading(false)
    }
  }

  const sendGift = async () => {
    if (!selectedGift || !selectedUser) {
      setMessage('❌ 請選擇禮物和接收者')
      return
    }

    if (userCoins < selectedGift.coinCost) {
      setMessage(`❌ 金幣不足！需要 ${selectedGift.coinCost} 金幣，當前餘額 ${userCoins} 金幣`)
      return
    }

    setSending(true)
    setMessage('')

    try {
      const response = await fetch('/api/gifts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          giftName: selectedGift.name,
          channelId: 'gift-channel-123'
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ 成功贈送 ${selectedGift.emoji} ${selectedGift.name} 給 ${selectedUser.name}！`)
        setUserCoins(data.newBalance)
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
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">🎁 送禮物</h1>
        
        {/* 金幣餘額顯示 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-yellow-600/20 border border-yellow-500/30 rounded-lg px-6 py-3">
            <span className="text-yellow-400 text-2xl mr-3">🪙</span>
            <span className="text-xl font-bold">當前餘額：{userCoins} 金幣</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 選擇禮物 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">選擇禮物</h2>
            <div className="grid grid-cols-2 gap-4">
              {gifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift)}
                  disabled={userCoins < gift.coinCost}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedGift?.id === gift.id
                      ? 'border-yellow-500 bg-yellow-500/20'
                      : userCoins < gift.coinCost
                      ? 'border-gray-700 bg-gray-700/50 opacity-50 cursor-not-allowed'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <div className="text-3xl mb-2">{gift.emoji}</div>
                  <div className="font-semibold">{gift.name}</div>
                  <div className="text-sm text-gray-400">{gift.coinCost} 金幣</div>
                  {userCoins < gift.coinCost && (
                    <div className="text-xs text-red-400 mt-1">金幣不足</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 選擇接收者 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">選擇接收者</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
            disabled={!selectedGift || !selectedUser || sending || userCoins < (selectedGift?.coinCost || 0)}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '送禮物中...' : `🎁 送禮物 (${selectedGift?.coinCost || 0} 金幣)`}
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
            <li>• 確認您有足夠的金幣</li>
            <li>• 點擊「送禮物」按鈕</li>
            <li>• 系統會扣除您的金幣並增加接收者的收益</li>
            <li>• 接收者會收到相應的收益記錄</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
