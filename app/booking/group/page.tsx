'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import SecureImage from '@/components/SecureImage'

interface Partner {
  id: string
  name: string
  coverImage: string
  games: string[]
  halfHourlyRate: number
  allowGroupBooking: boolean
  averageRating: number
  reviewCount: number
  user: {
    email: string
    isSuspended: boolean
    suspensionEndsAt?: string
  }
}

interface GroupBooking {
  id: string
  title: string
  description?: string
  maxParticipants: number
  currentParticipants: number
  pricePerPerson: number
  games?: string[]
  startTime: string
  endTime: string
  status: string
  partner: Partner
  creator: {
    id: string
    user: {
      name: string
      email: string
    }
  }
  bookings: Array<{
    id: string
    customer: {
      user: {
        name: string
        email: string
      }
    }
  }>
  GroupBookingParticipant?: Array<{
    id: string
    customerId: string
    partnerId?: string
    status: string
    joinedAt: string
  }>
  isJoined?: boolean // 標記當前用戶是否已加入
}

function GroupBookingContent() {
  const searchParams = useSearchParams()
  const partnerId = searchParams.get('partnerId')
  const { data: session, status } = useSession()
  const user = session?.user
  const isAuthenticated = status === 'authenticated'
  const authLoading = status === 'loading'

  const [partners, setPartners] = useState<Partner[]>([])
  const [groupBookings, setGroupBookings] = useState<GroupBooking[]>([])
  const [availableGroupBookings, setAvailableGroupBookings] = useState<GroupBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedStartTime, setSelectedStartTime] = useState('')
  const [selectedEndTime, setSelectedEndTime] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [selectedGroupBooking, setSelectedGroupBooking] = useState<GroupBooking | null>(null)
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set())

  // 創建群組表單狀態
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    maxParticipants: 4
  })

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadGroupBookings()
    }
  }, [isAuthenticated, user?.id])

  const loadGroupBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/group-booking?status=ACTIVE')
      if (response.ok) {
        const data = await response.json()
        // 檢查用戶是否已加入每個群組
        const updatedBookings = data.map((booking: GroupBooking) => {
          // 檢查參與者列表中是否有當前用戶
          const isJoined = booking.GroupBookingParticipant?.some(
            (participant) => {
              // 檢查參與者的 customer 的 user.id 是否等於當前用戶的 id
              return (participant as any).Customer?.user?.id === user?.id
            }
          ) || joinedGroupIds.has(booking.id)
          return { ...booking, isJoined }
        })
        setGroupBookings(updatedBookings)
      }
    } catch (error) {
      console.error('載入群組預約失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchAvailablePartners = async () => {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      alert('請選擇日期和時間')
      return
    }

    try {
      setLoading(true)
      const startDateTime = `${selectedDate}T${selectedStartTime}`
      const endDateTime = `${selectedDate}T${selectedEndTime}`
      
      const params = new URLSearchParams({
        startTime: startDateTime,
        endTime: endDateTime
      })
      
      if (selectedGame) {
        params.append('game', selectedGame)
      }

      const response = await fetch(`/api/group-booking/available-partners?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPartners(data.partners || [])
        // 檢查用戶是否已加入每個群組
        const updatedGroupBookings = (data.groupBookings || []).map((booking: GroupBooking) => {
          const isJoined = booking.GroupBookingParticipant?.some(
            (participant) => {
              return (participant as any).Customer?.user?.id === user?.id
            }
          ) || joinedGroupIds.has(booking.id)
          return { ...booking, isJoined }
        })
        setAvailableGroupBookings(updatedGroupBookings)
      } else {
        console.error('搜尋夥伴失敗')
      }
    } catch (error) {
      console.error('搜尋夥伴失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const createGroupBooking = async (partner: Partner) => {
    if (!createForm.title.trim()) {
      alert('請輸入群組標題')
      return
    }

    try {
      setLoading(true)
      const startDateTime = `${selectedDate}T${selectedStartTime}`
      const endDateTime = `${selectedDate}T${selectedEndTime}`

      const response = await fetch('/api/group-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId: partner.id,
          title: createForm.title,
          description: createForm.description,
          maxParticipants: createForm.maxParticipants,
          pricePerPerson: partner.halfHourlyRate,
          startTime: startDateTime,
          endTime: endDateTime
        })
      })

      if (response.ok) {
        alert('群組預約創建成功！')
        setShowCreateForm(false)
        setCreateForm({ title: '', description: '', maxParticipants: 4 })
        loadGroupBookings()
      } else {
        const error = await response.json()
        alert(error.error || '創建失敗')
      }
    } catch (error) {
      console.error('創建群組預約失敗:', error)
      alert('創建失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinClick = (booking: GroupBooking) => {
    setSelectedGroupBooking(booking)
    setShowJoinModal(true)
  }

  const handleConfirmJoin = async (retryCount = 0) => {
    if (!selectedGroupBooking) return

    try {
      setLoading(true)
      const response = await fetch('/api/group-booking/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupBookingId: selectedGroupBooking.id
        })
      })

      const result = await response.json()

      if (response.ok) {
        // 成功加入
        setShowJoinModal(false)
        setJoinedGroupIds(prev => new Set(prev).add(selectedGroupBooking.id))
        if (result.alreadyJoined) {
          console.log('已經在群組中:', result.message)
        } else {
          alert('成功加入群組預約！')
        }
        loadGroupBookings()
        setSelectedGroupBooking(null)
      } else {
        // 處理錯誤響應
        if (result.code === 'ALREADY_JOINED' || response.status === 409) {
          setShowJoinModal(false)
          setJoinedGroupIds(prev => new Set(prev).add(selectedGroupBooking.id))
          console.log('已經加入群組:', result.details)
          loadGroupBookings()
          setSelectedGroupBooking(null)
          return
        }

        // 對於其他錯誤，顯示訊息
        const errorMessage = result.details 
          ? `${result.error}\n${result.details}` 
          : result.error || '加入失敗'
        
        // 對於某些錯誤，可以重試
        if ((response.status === 500 || response.status === 503) && retryCount < 2) {
          console.warn(`加入失敗，${retryCount + 1}秒後重試...`)
          setTimeout(() => {
            handleConfirmJoin(retryCount + 1)
          }, (retryCount + 1) * 1000)
          return
        }
        
        alert(errorMessage)
        setShowJoinModal(false)
        setSelectedGroupBooking(null)
      }
    } catch (error) {
      console.error('加入群組預約失敗:', error)
      
      // 網絡錯誤時可以重試
      if (retryCount < 2) {
        console.warn(`網絡錯誤，${retryCount + 1}秒後重試...`)
        setTimeout(() => {
          handleConfirmJoin(retryCount + 1)
        }, (retryCount + 1) * 1000)
        return
      }
      
      alert('加入失敗，請檢查網絡連線後重試')
      setShowJoinModal(false)
      setSelectedGroupBooking(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelJoin = () => {
    setShowJoinModal(false)
    setSelectedGroupBooking(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">請先登入</h1>
          <p className="text-gray-600">您需要登入才能使用群組預約功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">群組預約</h1>
          <p className="text-gray-600">尋找有趣的群組預約，與其他玩家一起遊戲</p>
        </div>

        {/* 時間篩選器 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">🎯 選擇時間和遊戲</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
              <input
                type="time"
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">結束時間</label>
              <input
                type="time"
                value={selectedEndTime}
                onChange={(e) => setSelectedEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">遊戲 (可選)</label>
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="">不限遊戲</option>
                <option value="英雄聯盟">英雄聯盟</option>
                <option value="傳說對決">傳說對決</option>
                <option value="王者榮耀">王者榮耀</option>
                <option value="原神">原神</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={searchAvailablePartners}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '搜尋中...' : '🔍 搜尋有空夥伴'}
            </button>
          </div>
        </div>

        {/* 搜尋結果 - 可用群組預約 */}
        {availableGroupBookings.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">🎮 可用群組預約 ({availableGroupBookings.length} 個)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableGroupBookings.map((group) => (
                <div key={group.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden relative bg-gradient-to-br from-purple-400 to-blue-400">
                      <SecureImage
                        src={group.partner.coverImage}
                        alt={group.partner.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{group.partner.name}</h3>
                      <p className="text-sm text-gray-600">每半小時 ${group.partner.halfHourlyRate}</p>
                      {group.partner.averageRating > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-sm">{group.partner.averageRating}</span>
                          <span className="text-sm text-gray-500">({group.partner.reviewCount})</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-900">{group.title}</h4>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                    {group.games && group.games.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {group.games.map((game, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {game}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <span>👥 {group.currentParticipants}/{group.maxParticipants} 人</span>
                    <span>💰 ${group.pricePerPerson}/人</span>
                    <span>📅 {new Date(group.startTime).toLocaleDateString('zh-TW')}</span>
                  </div>
                  
                  {group.currentParticipants < group.maxParticipants ? (
                    group.isJoined || joinedGroupIds.has(group.id) ? (
                      <span className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg text-center font-medium">
                        已加入
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoinClick(group)}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        加入群組
                      </button>
                    )
                  ) : (
                    <span className="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-center">
                      已滿
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搜尋結果 - 可用夥伴 */}
        {partners.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">🎮 可用夥伴 ({partners.length} 位)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <div key={partner.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden relative bg-gradient-to-br from-purple-400 to-blue-400">
                      <SecureImage
                        src={partner.coverImage}
                        alt={partner.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{partner.name}</h3>
                      <p className="text-sm text-gray-600">每半小時 ${partner.halfHourlyRate}</p>
                      {partner.averageRating > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-yellow-500">⭐</span>
                          <span className="text-sm">{partner.averageRating}</span>
                          <span className="text-sm text-gray-500">({partner.reviewCount})</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {partner.games.map((game, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {game}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPartner(partner)
                      setShowCreateForm(true)
                    }}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    創建群組預約
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 創建群組表單 */}
        {showCreateForm && selectedPartner && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">創建群組預約 - {selectedPartner.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">群組標題 *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                  placeholder="例如：一起上分！"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">群組描述</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="描述一下這個群組的目標或規則..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">最大參與人數</label>
                <select
                  value={createForm.maxParticipants}
                  onChange={(e) => setCreateForm({...createForm, maxParticipants: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2}>2 人</option>
                  <option value={3}>3 人</option>
                  <option value={4}>4 人</option>
                  <option value={5}>5 人</option>
                  <option value={6}>6 人</option>
                </select>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => createGroupBooking(selectedPartner)}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '創建中...' : '創建群組'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setSelectedPartner(null)
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 確認加入 Modal */}
        {showJoinModal && selectedGroupBooking && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleCancelJoin}
          >
            <div 
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">確認加入群組</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{selectedGroupBooking.title}</h3>
                    {selectedGroupBooking.description && (
                      <p className="text-gray-600 text-sm">{selectedGroupBooking.description}</p>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">夥伴：</span>
                        <span className="font-medium text-gray-900 ml-2">{selectedGroupBooking.partner.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">價格：</span>
                        <span className="font-medium text-gray-900 ml-2">${selectedGroupBooking.pricePerPerson}/人</span>
                      </div>
                      <div>
                        <span className="text-gray-500">參與人數：</span>
                        <span className="font-medium text-gray-900 ml-2">
                          {selectedGroupBooking.currentParticipants}/{selectedGroupBooking.maxParticipants} 人
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">日期時間：</span>
                        <span className="font-medium text-gray-900 ml-2">
                          {new Date(selectedGroupBooking.startTime).toLocaleString('zh-TW')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedGroupBooking.games && selectedGroupBooking.games.length > 0 && (
                    <div>
                      <span className="text-gray-500 text-sm">遊戲：</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedGroupBooking.games.map((game, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {game}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between gap-4">
                  <button
                    onClick={handleCancelJoin}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmJoin}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? '加入中...' : '確認加入'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 現有群組預約 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">🔥 熱門群組預約</h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">載入中...</p>
            </div>
          ) : groupBookings.length > 0 ? (
            <div className="space-y-4">
              {groupBookings.map((booking) => (
                <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{booking.title}</h3>
                      {booking.description && (
                        <p className="text-gray-600 text-sm mt-1">{booking.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {booking.currentParticipants}/{booking.maxParticipants} 人
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(booking.startTime).toLocaleString('zh-TW')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden relative bg-gradient-to-br from-purple-400 to-blue-400">
                        <SecureImage
                          src={booking.partner.coverImage}
                          alt={booking.partner.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <span className="text-sm font-medium">{booking.partner.name}</span>
                      <span className="text-sm text-gray-500">每半小時 ${booking.partner.halfHourlyRate}</span>
                    </div>
                    
                    {booking.currentParticipants < booking.maxParticipants ? (
                      booking.isJoined || joinedGroupIds.has(booking.id) ? (
                        <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
                          已加入
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoinClick(booking)}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          加入群組
                        </button>
                      )
                    ) : (
                      <span className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg">
                        已滿
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">目前沒有可用的群組預約</p>
              <p className="text-sm text-gray-400 mt-2">請選擇時間搜尋可用夥伴，或創建新的群組預約</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GroupBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    }>
      <GroupBookingContent />
    </Suspense>
  )
}