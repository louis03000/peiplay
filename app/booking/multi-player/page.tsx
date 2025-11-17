'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import SecureImage from '@/components/SecureImage'

interface Partner {
  id: string
  name: string
  coverImage: string
  games: string[]
  halfHourlyRate: number
  averageRating: number
  totalReviews: number
  matchingSchedule: {
    id: string
    startTime: string
    endTime: string
  }
}

interface MultiPlayerBooking {
  id: string
  date: string
  startTime: string
  endTime: string
  games: string[]
  status: string
  totalAmount: number
  lastAdjustmentAt?: string
  bookings: Array<{
    id: string
    status: string
    schedule: {
      partner: {
        id: string
        name: string
        coverImage: string
        halfHourlyRate: number
        user: {
          name: string
          email: string
        }
      }
      startTime: string
      endTime: string
    }
    originalAmount: number
  }>
}

function MultiPlayerBookingContent() {
  const { data: session, status } = useSession()
  const user = session?.user
  const isAuthenticated = status === 'authenticated'
  const authLoading = status === 'loading'

  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set())
  const [myBookings, setMyBookings] = useState<MultiPlayerBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  
  // 篩選條件
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedStartTime, setSelectedStartTime] = useState('')
  const [selectedEndTime, setSelectedEndTime] = useState('')
  const [selectedGames, setSelectedGames] = useState<string[]>([])

  // 可用的遊戲列表（從夥伴中提取）
  const [availableGames, setAvailableGames] = useState<string[]>([])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadMyBookings()
      loadViolationCount()
    }
  }, [isAuthenticated, user?.id])

  const loadMyBookings = async () => {
    try {
      const response = await fetch('/api/multi-player-booking')
      if (response.ok) {
        const data = await response.json()
        setMyBookings(data.multiPlayerBookings || [])
      }
    } catch (error) {
      console.error('載入多人陪玩群組失敗:', error)
    }
  }

  const loadViolationCount = async () => {
    try {
      const response = await fetch('/api/customer/me')
      if (response.ok) {
        const data = await response.json()
        setViolationCount(data.violationCount || 0)
      }
    } catch (error) {
      // 如果 API 不存在，忽略錯誤
      console.log('無法載入違規次數')
    }
  }

  const searchPartners = async () => {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      alert('請選擇日期和時間')
      return
    }

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const selectedStartDateTime = new Date(`${selectedDate}T${selectedStartTime}:00`)
    
    if (selectedStartDateTime <= twoHoursLater) {
      alert('預約時段必須在現在時間的2小時之後')
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams({
        date: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
      })
      
      if (selectedGames.length > 0) {
        params.append('games', selectedGames.join(','))
      }

      const response = await fetch(`/api/partners/search-for-multi-player?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPartners(data || [])
        
        // 提取所有遊戲
        const gamesSet = new Set<string>()
        data.forEach((partner: Partner) => {
          partner.games.forEach(game => gamesSet.add(game))
        })
        setAvailableGames(Array.from(gamesSet))
      } else {
        const error = await response.json()
        alert(error.error || '搜尋失敗')
      }
    } catch (error) {
      console.error('搜尋夥伴失敗:', error)
      alert('搜尋失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const togglePartnerSelection = (scheduleId: string) => {
    const newSelected = new Set(selectedPartners)
    if (newSelected.has(scheduleId)) {
      newSelected.delete(scheduleId)
    } else {
      newSelected.add(scheduleId)
    }
    setSelectedPartners(newSelected)
  }

  const createMultiPlayerBooking = async () => {
    if (selectedPartners.size === 0) {
      alert('請至少選擇一位夥伴')
      return
    }

    if (violationCount >= 3) {
      alert('您的帳號已被停權，無法創建預約')
      return
    }

    try {
      setLoading(true)
      const partnerScheduleIds = Array.from(selectedPartners)

      const response = await fetch('/api/multi-player-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          startTime: selectedStartTime,
          endTime: selectedEndTime,
          games: selectedGames,
          partnerScheduleIds,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert('多人陪玩群組創建成功！')
        setSelectedPartners(new Set())
        loadMyBookings()
        loadViolationCount()
      } else {
        const error = await response.json()
        alert(error.error || '創建失敗')
      }
    } catch (error) {
      console.error('創建多人陪玩群組失敗:', error)
      alert('創建失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const removePartner = async (bookingId: string, reason: string) => {
    if (!reason || reason.trim().length === 0) {
      alert('請提供移除理由')
      return
    }

    const booking = myBookings.find(b => b.bookings.some(book => book.id === bookingId))
    if (!booking) return

    // 檢查調整期限
    const now = new Date()
    const thirtyMinutesBeforeStart = new Date(new Date(booking.startTime).getTime() - 30 * 60 * 1000)
    
    if (now >= thirtyMinutesBeforeStart) {
      alert('時段開始前30分鐘無法再調整')
      return
    }

    if (!confirm('確定要移除這位夥伴嗎？移除已同意的夥伴會被記錄違規。')) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/multi-player-booking/${booking.id}/remove-partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          reason: reason.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || '已移除夥伴')
        loadMyBookings()
        loadViolationCount()
      } else {
        const error = await response.json()
        alert(error.error || '移除失敗')
      }
    } catch (error) {
      console.error('移除夥伴失敗:', error)
      alert('移除失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalAmount = () => {
    let total = 0
    selectedPartners.forEach(scheduleId => {
      const partner = partners.find(p => p.matchingSchedule.id === scheduleId)
      if (partner) {
        const durationHours = (new Date(partner.matchingSchedule.endTime).getTime() - 
                               new Date(partner.matchingSchedule.startTime).getTime()) / (1000 * 60 * 60)
        total += durationHours * partner.halfHourlyRate * 2
      }
    })
    return total
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
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
          <p className="text-gray-600">您需要登入才能使用多人陪玩功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">多人陪玩</h1>
          <p className="text-gray-600">一次選擇多位夥伴，享受更豐富的遊戲體驗</p>
        </div>

        {/* 違規警告 */}
        {violationCount > 0 && (
          <div className={`mb-6 p-4 rounded-lg ${
            violationCount >= 3 
              ? 'bg-red-50 border border-red-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-start">
              <span className="text-2xl mr-3">
                {violationCount >= 3 ? '⚠️' : '⚠️'}
              </span>
              <div>
                <h3 className={`font-semibold ${
                  violationCount >= 3 ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  {violationCount >= 3 
                    ? '您的帳號已被停權' 
                    : `您已違規 ${violationCount} 次`}
                </h3>
                <p className={`text-sm mt-1 ${
                  violationCount >= 3 ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {violationCount >= 3
                    ? '移除已同意夥伴的違規次數已達3次，帳號已被永久停權'
                    : `再違規 ${3 - violationCount} 次將被停權。移除已同意的夥伴會被記錄違規。`}
                </p>
              </div>
            </div>
          </div>
        )}

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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
              <input
                type="time"
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">結束時間</label>
              <input
                type="time"
                value={selectedEndTime}
                onChange={(e) => setSelectedEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">遊戲項目（可選）</label>
              <select
                multiple
                value={selectedGames}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  setSelectedGames(values)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                size={3}
              >
                {availableGames.map(game => (
                  <option key={game} value={game}>{game}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">按住 Ctrl/Cmd 可多選</p>
            </div>
          </div>
          <button
            onClick={searchPartners}
            disabled={loading}
            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
          >
            {loading ? '搜尋中...' : '搜尋夥伴'}
          </button>
        </div>

        {/* 夥伴列表 */}
        {partners.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              符合條件的夥伴 ({partners.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => {
                const isSelected = selectedPartners.has(partner.matchingSchedule.id)
                return (
                  <div
                    key={partner.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                    onClick={() => togglePartnerSelection(partner.matchingSchedule.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden relative flex-shrink-0">
                        <SecureImage
                          src={partner.coverImage}
                          alt={partner.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{partner.name}</h3>
                        <p className="text-sm text-gray-600">
                          每半小時 ${partner.halfHourlyRate}
                        </p>
                        <p className="text-sm text-gray-600">
                          ⭐ {partner.averageRating} ({partner.totalReviews} 評價)
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {partner.games.slice(0, 3).map(game => (
                            <span
                              key={game}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                            >
                              {game}
                            </span>
                          ))}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="text-purple-500 text-xl">✓</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {selectedPartners.size > 0 && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">已選擇 {selectedPartners.size} 位夥伴</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      總費用：${calculateTotalAmount().toFixed(0)}
                    </p>
                  </div>
                  <button
                    onClick={createMultiPlayerBooking}
                    disabled={loading || violationCount >= 3}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                  >
                    {loading ? '創建中...' : '創建多人陪玩'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 我的多人陪玩群組 */}
        {myBookings.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">我的多人陪玩群組</h2>
            <div className="space-y-4">
              {myBookings.map((booking) => (
                <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {new Date(booking.startTime).toLocaleString('zh-TW', {
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} - {new Date(booking.endTime).toLocaleString('zh-TW', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        狀態：{booking.status === 'PENDING' ? '等待確認' : 
                               booking.status === 'ACTIVE' ? '進行中' :
                               booking.status === 'COMPLETED' ? '已完成' : '已取消'}
                      </p>
                      <p className="text-sm text-gray-600">
                        總費用：${booking.totalAmount.toFixed(0)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {booking.bookings.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden relative">
                            <SecureImage
                              src={b.schedule.partner.coverImage}
                              alt={b.schedule.partner.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {b.schedule.partner.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              狀態：{b.status === 'CONFIRMED' || b.status === 'PARTNER_ACCEPTED' 
                                ? '✓ 已確認' 
                                : b.status === 'REJECTED' 
                                ? '✗ 已拒絕' 
                                : b.status === 'CANCELLED'
                                ? '已移除'
                                : '等待確認'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ${b.originalAmount.toFixed(0)}
                          </p>
                          {(b.status === 'CONFIRMED' || b.status === 'PARTNER_ACCEPTED') && (
                            <button
                              onClick={() => {
                                const reason = prompt('請提供移除理由：')
                                if (reason) {
                                  removePartner(b.id, reason)
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800 mt-1"
                            >
                              移除
                            </button>
                          )}
                          {(b.status === 'REJECTED' || b.status === 'PAID_WAITING_PARTNER_CONFIRMATION') && (
                            <button
                              onClick={() => {
                                const reason = prompt('請提供移除理由（可選）：')
                                removePartner(b.id, reason || '用戶主動移除')
                              }}
                              className="text-xs text-gray-600 hover:text-gray-800 mt-1"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MultiPlayerBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    }>
      <MultiPlayerBookingContent />
    </Suspense>
  )
}

