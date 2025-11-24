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
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null) // 選中的時長（小時）

  // 可用的遊戲列表（從夥伴中提取）
  const [availableGames, setAvailableGames] = useState<string[]>([])
  const [otherGame, setOtherGame] = useState('')
  const [showOtherInput, setShowOtherInput] = useState(false)

  // 根據開始時間和時長自動計算結束時間
  const handleDurationSelect = (hours: number) => {
    setSelectedDuration(hours)
    if (selectedStartTime) {
      const [hoursStr, minutesStr] = selectedStartTime.split(':')
      const startDate = new Date()
      startDate.setHours(parseInt(hoursStr), parseInt(minutesStr), 0, 0)
      const endDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000)
      const endHours = endDate.getHours().toString().padStart(2, '0')
      const endMinutes = endDate.getMinutes().toString().padStart(2, '0')
      // 確保結束時間也是每半小時
      const roundedMinutes = parseInt(endMinutes) < 30 ? '00' : '30'
      setSelectedEndTime(`${endHours}:${roundedMinutes}`)
    }
  }

  // 當開始時間改變時，如果有選中時長，自動更新結束時間
  useEffect(() => {
    if (selectedStartTime && selectedDuration !== null) {
      const [hoursStr, minutesStr] = selectedStartTime.split(':')
      const startDate = new Date()
      startDate.setHours(parseInt(hoursStr), parseInt(minutesStr), 0, 0)
      const endDate = new Date(startDate.getTime() + selectedDuration * 60 * 60 * 1000)
      const endHours = endDate.getHours().toString().padStart(2, '0')
      const endMinutes = endDate.getMinutes().toString().padStart(2, '0')
      // 確保結束時間也是每半小時
      const roundedMinutes = parseInt(endMinutes) < 30 ? '00' : '30'
      setSelectedEndTime(`${endHours}:${roundedMinutes}`)
    }
  }, [selectedStartTime, selectedDuration])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadMyBookings()
      loadViolationCount()
      loadGamesList()
    }
  }, [isAuthenticated, user?.id])

  const loadGamesList = async () => {
    try {
      const response = await fetch('/api/games/list')
      if (response.ok) {
        const data = await response.json()
        setAvailableGames(data.games || [])
      }
    } catch (error) {
      console.error('載入遊戲列表失敗:', error)
    }
  }

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
    console.log('🔵 ========== 前端開始搜索 ==========')
    console.log('🔵 選擇的參數:', {
      selectedDate,
      selectedStartTime,
      selectedEndTime,
      selectedGames,
      otherGame
    })
    
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      console.log('❌ 缺少必要參數')
      alert('請選擇日期和時間')
      return
    }

    // 檢查時段是否在「現在+2小時」之後
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const selectedStartDateTime = new Date(`${selectedDate}T${selectedStartTime}:00`)
    
    console.log('🔵 時間檢查:', {
      now: now.toISOString(),
      twoHoursLater: twoHoursLater.toISOString(),
      selectedStartDateTime: selectedStartDateTime.toISOString(),
      isValid: selectedStartDateTime > twoHoursLater
    })
    
    if (selectedStartDateTime <= twoHoursLater) {
      console.log('❌ 時段太早')
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
      
      // 組合選中的遊戲和自定義遊戲
      const allGames = [...selectedGames]
      if (otherGame && otherGame.trim().length > 0) {
        allGames.push(otherGame.trim())
      }
      
      if (allGames.length > 0) {
        params.append('games', allGames.join(','))
      }

      const apiUrl = `/api/partners/search-for-multi-player?${params}`
      console.log('🔍 前端發送搜索請求:', {
        url: apiUrl,
        date: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        games: allGames
      })

      const response = await fetch(apiUrl)
      console.log('📡 API 響應狀態:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API 錯誤響應:', errorText)
        try {
          const error = JSON.parse(errorText)
          console.error('❌ 解析後的錯誤:', error)
          
          // 顯示詳細的錯誤訊息
          let errorMessage = error.error || '搜尋失敗'
          if (error.details) {
            errorMessage += `\n\n詳細資訊：${JSON.stringify(error.details, null, 2)}`
          }
          if (error.message) {
            errorMessage += `\n\n訊息：${error.message}`
          }
          if (error.received) {
            errorMessage += `\n\n接收到的參數：${JSON.stringify(error.received, null, 2)}`
          }
          
          alert(errorMessage)
        } catch (e) {
          console.error('❌ 無法解析錯誤響應:', e)
          alert(`搜尋失敗: ${response.status} ${response.statusText}\n\n請檢查瀏覽器 Console 查看詳細錯誤訊息`)
        }
        return
      }
      
      const data = await response.json()
      console.log('🔍 搜索結果:', data)
      console.log('🔍 結果數量:', Array.isArray(data) ? data.length : 0)
      
      const partnersList = Array.isArray(data) ? data : []
      setPartners(partnersList)
      
      // 提取所有遊戲
      const gamesSet = new Set<string>()
      partnersList.forEach((partner: Partner) => {
        if (partner.games && Array.isArray(partner.games)) {
          partner.games.forEach(game => gamesSet.add(game))
        }
      })
      setAvailableGames(Array.from(gamesSet))
      
      if (partnersList.length === 0) {
        // 顯示更詳細的訊息，幫助用戶理解為什麼沒有找到夥伴
        const searchInfo = `日期：${selectedDate}\n開始時間：${selectedStartTime}\n結束時間：${selectedEndTime}${allGames.length > 0 ? `\n遊戲：${allGames.join(', ')}` : ''}`
        alert(`沒有找到符合條件的夥伴\n\n搜尋條件：\n${searchInfo}\n\n可能的原因：\n1. 該時段沒有可用的夥伴\n2. 選擇的遊戲沒有匹配的夥伴\n3. 時段已被預約\n\n建議：\n- 嘗試選擇其他時段\n- 移除遊戲篩選條件\n- 選擇更長的時間範圍`)
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

      // 組合選中的遊戲和自定義遊戲
      const allGames = [...selectedGames]
      if (otherGame && otherGame.trim().length > 0) {
        allGames.push(otherGame.trim())
      }

      const response = await fetch('/api/multi-player-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          startTime: selectedStartTime,
          endTime: selectedEndTime,
          games: allGames,
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
          
          {/* 日期和時間選擇 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
              <select
                value={selectedStartTime}
                onChange={(e) => {
                  setSelectedStartTime(e.target.value)
                  setSelectedDuration(null) // 清除時長選擇，讓用戶手動調整
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              >
                <option value="">請選擇</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const hour = Math.floor(i / 2)
                  const minute = (i % 2) * 30
                  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                  return (
                    <option key={timeStr} value={timeStr}>
                      {timeStr}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">結束時間</label>
              <select
                value={selectedEndTime}
                onChange={(e) => {
                  setSelectedEndTime(e.target.value)
                  setSelectedDuration(null) // 清除時長選擇
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              >
                <option value="">請選擇</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const hour = Math.floor(i / 2)
                  const minute = (i % 2) * 30
                  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                  return (
                    <option key={timeStr} value={timeStr}>
                      {timeStr}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          {/* 時長快捷按鈕 */}
          {selectedStartTime && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">快速選擇時長</label>
              <div className="flex flex-wrap gap-2">
                {[0.5, 1, 1.5, 2, 2.5, 3, 4].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => handleDurationSelect(hours)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                      selectedDuration === hours
                        ? 'bg-purple-500 text-white border-purple-500 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {hours === 0.5 ? '30分鐘' : hours === 1 ? '1小時' : hours === 1.5 ? '1.5小時' : `${hours}小時`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 遊戲項目選擇 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">遊戲項目（可選）</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {availableGames.map((game) => {
                const isSelected = selectedGames.includes(game)
                return (
                  <button
                    key={game}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedGames(selectedGames.filter(g => g !== game))
                      } else {
                        setSelectedGames([...selectedGames, game])
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-purple-500 text-white border-purple-500 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {game} {isSelected && '✓'}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  if (showOtherInput) {
                    setShowOtherInput(false)
                    setOtherGame('')
                  } else {
                    setShowOtherInput(true)
                  }
                }}
                className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                  showOtherInput
                    ? 'bg-purple-500 text-white border-purple-500 shadow-md'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                }`}
              >
                其他 {showOtherInput && '✓'}
              </button>
            </div>
            {showOtherInput && (
              <div className="mt-2">
                <input
                  type="text"
                  value={otherGame}
                  onChange={(e) => setOtherGame(e.target.value)}
                  placeholder="請輸入遊戲名稱"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                />
              </div>
            )}
            {selectedGames.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                已選擇：{selectedGames.join('、')}
              </div>
            )}
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
                if (!partner.matchingSchedule || !partner.matchingSchedule.id) {
                  console.warn('⚠️ 夥伴缺少 matchingSchedule:', partner)
                  return null
                }
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

