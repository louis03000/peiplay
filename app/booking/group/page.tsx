'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthContext } from '@/lib/AuthProvider'
import { authenticatedFetch } from '@/lib/api'

interface Partner {
  id: string
  name: string
  coverImage: string
  games: string[]
  halfHourlyRate: number
  allowGroupBooking: boolean
  user: {
    email: string
  }
}

interface GroupBooking {
  id: string
  title: string
  description?: string
  maxParticipants: number
  currentParticipants: number
  startTime: string
  endTime: string
  status: 'ACTIVE' | 'FULL' | 'CANCELLED' | 'COMPLETED'
  partner: Partner
  creator: {
    id: string
    name: string
    user: {
      email: string
    }
  }
  bookings: Array<{
    id: string
    customer: {
      id: string
      name: string
      user: {
        email: string
      }
    }
  }>
}

export default function GroupBookingPage() {
  const searchParams = useSearchParams()
  const partnerId = searchParams.get('partnerId')
  const { user, isAuthenticated, loading: authLoading } = useAuthContext()
  
  const [partner, setPartner] = useState<Partner | null>(null)
  const [groupBookings, setGroupBookings] = useState<GroupBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)

  // 表單狀態
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxParticipants: 4,
    startTime: '',
    endTime: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      window.location.href = '/auth/login'
      return
    }
    loadData()
  }, [isAuthenticated, authLoading, partnerId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      if (partnerId) {
        // 載入特定夥伴的群組預約
        const [partnerRes, groupBookingsRes] = await Promise.all([
          authenticatedFetch(`/api/partners/${partnerId}`),
          authenticatedFetch(`/api/group-booking?partnerId=${partnerId}&status=ACTIVE`)
        ])

        if (partnerRes.ok) {
          const partnerData = await partnerRes.json()
          setPartner(partnerData)
        }

        if (groupBookingsRes.ok) {
          const groupBookingsData = await groupBookingsRes.json()
          setGroupBookings(groupBookingsData)
        }
      } else {
        // 載入所有活躍的群組預約
        const groupBookingsRes = await authenticatedFetch('/api/group-booking?status=ACTIVE')
        if (groupBookingsRes.ok) {
          const groupBookingsData = await groupBookingsRes.json()
          setGroupBookings(groupBookingsData)
        }
      }
    } catch (error) {
      console.error('載入資料失敗:', error)
      setError('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!partnerId) {
      setError('請先選擇夥伴')
      return
    }

    try {
      const response = await authenticatedFetch('/api/group-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          ...formData
        })
      })

      if (response.ok) {
        setShowCreateForm(false)
        setFormData({
          title: '',
          description: '',
          maxParticipants: 4,
          startTime: '',
          endTime: ''
        })
        loadData() // 重新載入資料
      } else {
        const errorData = await response.json()
        setError(errorData.error || '創建群組預約失敗')
      }
    } catch (error) {
      console.error('創建群組預約失敗:', error)
      setError('創建群組預約失敗')
    }
  }

  const handleJoinGroup = async (groupBookingId: string) => {
    try {
      setJoining(groupBookingId)
      
      const response = await authenticatedFetch('/api/group-booking/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupBookingId })
      })

      if (response.ok) {
        loadData() // 重新載入資料
      } else {
        const errorData = await response.json()
        setError(errorData.error || '加入群組預約失敗')
      }
    } catch (error) {
      console.error('加入群組預約失敗:', error)
      setError('加入群組預約失敗')
    } finally {
      setJoining(null)
    }
  }

  const isUserInGroup = (groupBooking: GroupBooking) => {
    return groupBooking.bookings.some(booking => 
      booking.customer.user.email === user?.email
    )
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError('')
              loadData()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重試
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {partner ? `${partner.name} 的群組預約` : '群組預約'}
          </h1>
          <p className="text-gray-600">
            {partner ? '與其他玩家一起預約，享受更優惠的價格' : '尋找有趣的群組預約，與其他玩家一起遊戲'}
          </p>
        </div>

        {/* 夥伴資訊 */}
        {partner && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center space-x-4">
              <img 
                src={partner.coverImage} 
                alt={partner.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <h2 className="text-xl font-semibold">{partner.name}</h2>
                <p className="text-gray-600">每半小時 ${partner.halfHourlyRate}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {partner.games.map((game, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {game}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 創建群組按鈕 */}
        {partner && partner.allowGroupBooking && (
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🎮 創建群組預約
            </button>
          </div>
        )}

        {/* 創建群組表單 */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">創建群組預約</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  群組標題
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：英雄聯盟五排上分"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  群組描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="描述一下這次群組預約的內容..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大人數
                  </label>
                  <select
                    value={formData.maxParticipants}
                    onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={2}>2 人</option>
                    <option value={3}>3 人</option>
                    <option value={4}>4 人</option>
                    <option value={5}>5 人</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    結束時間
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  創建群組
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 群組預約列表 */}
        <div className="space-y-6">
          {groupBookings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">目前沒有可用的群組預約</p>
              {partner && partner.allowGroupBooking && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  創建第一個群組預約
                </button>
              )}
            </div>
          ) : (
            groupBookings.map((groupBooking) => (
              <div key={groupBooking.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {groupBooking.title}
                    </h3>
                    {groupBooking.description && (
                      <p className="text-gray-600 mt-1">{groupBooking.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      groupBooking.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      groupBooking.status === 'FULL' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {groupBooking.status === 'ACTIVE' ? '招募中' :
                       groupBooking.status === 'FULL' ? '已滿員' :
                       groupBooking.status}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">夥伴</p>
                    <p className="font-medium">{groupBooking.partner.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">時間</p>
                    <p className="font-medium">
                      {new Date(groupBooking.startTime).toLocaleString('zh-TW')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">參與人數</p>
                    <p className="font-medium">
                      {groupBooking.currentParticipants} / {groupBooking.maxParticipants}
                    </p>
                  </div>
                </div>

                {/* 參與者列表 */}
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">參與者：</p>
                  <div className="flex flex-wrap gap-2">
                    {groupBooking.bookings.map((booking) => (
                      <div key={booking.id} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                          {booking.customer.name.charAt(0)}
                        </div>
                        <span className="text-sm">{booking.customer.name}</span>
                        {booking.customer.id === groupBooking.creator.id && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">
                            創建者
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex justify-end">
                  {isUserInGroup(groupBooking) ? (
                    <span className="px-4 py-2 bg-green-100 text-green-800 rounded-md">
                      已加入
                    </span>
                  ) : groupBooking.status === 'ACTIVE' && groupBooking.currentParticipants < groupBooking.maxParticipants ? (
                    <button
                      onClick={() => handleJoinGroup(groupBooking.id)}
                      disabled={joining === groupBooking.id}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {joining === groupBooking.id ? '加入中...' : '加入群組'}
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-md">
                      {groupBooking.status === 'FULL' ? '已滿員' : '無法加入'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
