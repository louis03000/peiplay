'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import SecureImage from '@/components/SecureImage'
import PartnerCard from '@/components/PartnerCard'

interface Partner {
  id: string
  name: string
  coverImage: string
  images?: string[]
  rankBoosterImages?: string[]
  games: string[]
  halfHourlyRate: number
  averageRating: number
  totalReviews: number
  isAvailableNow?: boolean
  isRankBooster?: boolean
  supportsChatOnly?: boolean
  chatOnlyRate?: number
  customerMessage?: string
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
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null)

  // 可用的遊戲列表
  const [availableGames, setAvailableGames] = useState<string[]>([])
  const [otherGame, setOtherGame] = useState('')
  const [showOtherInput, setShowOtherInput] = useState(false)

  // 重新選擇夥伴相關狀態
  const [showReplacePartnerModal, setShowReplacePartnerModal] = useState(false)
  const [replacingBookingId, setReplacingBookingId] = useState<string | null>(null)
  const [replacingMultiPlayerBookingId, setReplacingMultiPlayerBookingId] = useState<string | null>(null)
  const [replacementPartners, setReplacementPartners] = useState<Partner[]>([])
  const [selectedReplacementPartner, setSelectedReplacementPartner] = useState<string | null>(null)

  // 確認創建多人陪玩 Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // 評論回饋相關狀態
  const [reviews, setReviews] = useState<Array<{
    id: string
    rating: number
    comment: string | null
    createdAt: string
    reviewerName: string
  }>>([])
  const [loadingReviews, setLoadingReviews] = useState(false)

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
      const roundedMinutes = parseInt(endMinutes) < 30 ? '00' : '30'
      setSelectedEndTime(`${endHours}:${roundedMinutes}`)
    }
  }, [selectedStartTime, selectedDuration])

  // 檢查並清除已過期的時間選擇
  useEffect(() => {
    if (!selectedDate) return
    
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // 如果選中的日期是今天，檢查時間是否已過期
    if (selectedDate === today) {
      if (selectedStartTime) {
        const [startHour, startMinute] = selectedStartTime.split(':').map(Number)
        const startDateTime = new Date(now)
        startDateTime.setHours(startHour, startMinute, 0, 0)
        
        if (startDateTime.getTime() < now.getTime()) {
          // 開始時間已過期，清除選擇
          setSelectedStartTime('')
          setSelectedEndTime('')
          setSelectedDuration(null)
        } else if (selectedEndTime) {
          // 檢查結束時間是否已過期
          const [endHour, endMinute] = selectedEndTime.split(':').map(Number)
          const endDateTime = new Date(now)
          endDateTime.setHours(endHour, endMinute, 0, 0)
          
          if (endDateTime.getTime() < now.getTime()) {
            // 結束時間已過期，清除結束時間
            setSelectedEndTime('')
            setSelectedDuration(null)
          }
        }
      }
    }
  }, [selectedDate, selectedStartTime, selectedEndTime])

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
        const now = new Date()
        
        // 過濾並處理預約：只顯示進行中或等待確認的群組，過濾掉已完成的
        const processedBookings = (data.multiPlayerBookings || [])
          .filter((booking: MultiPlayerBooking) => {
            const endTime = new Date(booking.endTime)
            const isExpired = endTime.getTime() < now.getTime()
            
            // 過濾掉已完成的群組（狀態為 COMPLETED 或時間已過）
            if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
              return false // 不顯示已取消的
            }
            
            // 如果時間已過，也不顯示（視為已完成）
            if (isExpired) {
              return false
            }
            
            return true // 只顯示進行中或等待確認的群組
          })
          .map((booking: MultiPlayerBooking) => {
            // 處理狀態顯示（雖然已經過濾，但保留邏輯以防萬一）
            const endTime = new Date(booking.endTime)
            const isExpired = endTime.getTime() < now.getTime()
            
            // 如果時間已過但狀態還是 ACTIVE 或 PENDING，標記為已完成
            if (isExpired && (booking.status === 'ACTIVE' || booking.status === 'PENDING')) {
              return {
                ...booking,
                status: 'COMPLETED' as const,
                _isAutoCompleted: true // 標記為自動完成
              }
            }
            
            return booking
          })
        
        setMyBookings(processedBookings)
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
      console.log('無法載入違規次數')
    }
  }

  // 載入所有多人陪玩的評論（不限制於自己的預約）
  const loadReviews = async () => {
    try {
      setLoadingReviews(true)
      // 🔥 獲取所有多人陪玩的評論（通過查詢所有 GroupBooking，然後獲取評論）
      // 由於多人陪玩的 GroupBooking.id 等於 MultiPlayerBooking.id，我們可以通過查詢所有 GroupBookingReview 來獲取
      const response = await fetch('/api/multi-player-booking/reviews')
      if (response.ok) {
        const data = await response.json()
        setReviews(data.reviews || [])
      }
    } catch (error) {
      console.error('載入評論失敗:', error)
    } finally {
      setLoadingReviews(false)
    }
  }

  // 當組件載入時，載入評論
  useEffect(() => {
    loadReviews()
  }, [])

  const searchPartners = async () => {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      alert('請選擇日期和時間')
      return
    }

    // 🔥 移除「必須預約兩小時後」的限制，允許立即搜索

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
      
      // 強制啟用調試模式（暫時用於診斷問題）
      // 可以通過 URL 參數 ?debug=false 來關閉
      const urlParams = new URLSearchParams(window.location.search)
      const forceDisableDebug = urlParams.get('debug') === 'false'
      const debugMode = !forceDisableDebug // 預設啟用調試模式
      
      if (debugMode) {
        params.append('debug', 'true')
        console.log('🔍 [多人陪玩搜索] 調試模式已啟用')
      }

      const response = await fetch(`/api/partners/search-for-multi-player?${params}`)
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '搜尋失敗')
        return
      }
      
      const data = await response.json()
      
      // 處理調試模式響應
      let partnersList: any[] = []
      let debugInfo: any = null
      
      // 檢查響應格式：可能是 { partners: [], debug: {} } 或直接是 []
      if (data.debug) {
        // 調試模式響應
        debugInfo = data.debug
        partnersList = Array.isArray(data.partners) ? data.partners : []
      } else {
        // 普通響應
        partnersList = Array.isArray(data) ? data : []
      }
      
      // 無論是否啟用調試模式，都輸出基本信息到控制台
      console.log('🔍 [多人陪玩搜索] API 響應:', data)
      console.log('📊 [多人陪玩搜索] 找到夥伴數量:', partnersList.length)
      
      // 如果有調試信息，詳細輸出
      if (debugInfo) {
        console.group('🔍 [多人陪玩搜索] 詳細調試信息')
        console.log('📥 請求參數:', debugInfo.requestParams)
        console.log('📊 查詢步驟:', debugInfo.steps)
        console.log('👥 夥伴詳情:', debugInfo.partners)
        console.log('🎯 最終結果:', debugInfo.finalResult)
        console.groupEnd()
        
        // 顯示調試信息彈窗
        const formatScheduleChecks = (partner: any) => {
          if (!partner.scheduleChecks || partner.scheduleChecks.length === 0) {
            return '  無時段檢查記錄'
          }
          return partner.scheduleChecks.map((check: any, idx: number) => {
            const reasons = []
            if (!check.isDateMatch) reasons.push('❌ 日期不匹配')
            if (!check.isTimeContained) reasons.push('❌ 時間不包含')
            if (!check.scheduleIsAvailable) reasons.push('❌ 時段不可用')
            if (check.hasActiveBooking) reasons.push('❌ 已有預約')
            
            // 顯示組合後的時段（實際用於匹配的時段）
            // 優先使用本地時間組合後的時段（scheduleDateLocal + startTime/endTime 的本地時間部分）
            const displayScheduleStart = check.scheduleStartCombinedLocal || check.scheduleStartCombinedUTC || check.scheduleStartCombined
            const displayScheduleEnd = check.scheduleEndCombinedLocal || check.scheduleEndCombinedUTC || check.scheduleEndCombined
            const displayScheduleDate = check.scheduleDateLocal || check.scheduleDateUTC || check.scheduleDate
            const displaySearchStart = check.searchStartLocal || check.searchStartUTC || check.searchStart
            const displaySearchEnd = check.searchEndLocal || check.searchEndUTC || check.searchEnd
            
            // 如果沒有組合後的時段，則顯示原始數據（僅用於調試）
            const fallbackStart = check.scheduleStartUTC || check.scheduleStart
            const fallbackEnd = check.scheduleEndUTC || check.scheduleEnd
            
            return `
  時段 ${idx + 1} (ID: ${check.scheduleId}):
    - 日期: ${displayScheduleDate}
    - 時段: ${displayScheduleStart || fallbackStart || 'N/A'} ~ ${displayScheduleEnd || fallbackEnd || 'N/A'}
    ${!displayScheduleStart ? `[原始數據: ${fallbackStart} ~ ${fallbackEnd}]` : ''}
    - 搜索: ${displaySearchStart} ~ ${displaySearchEnd}
    - 日期匹配: ${check.isDateMatch ? '✅' : '❌'}
    - 時間包含: ${check.isTimeContained ? '✅' : '❌'} ${check.timeContainedDetails ? `(${check.timeContainedDetails.startCheck}, ${check.timeContainedDetails.endCheck})` : ''}
    - 可用性: ${check.scheduleIsAvailable ? '✅' : '❌'}
    - 預約狀態: ${check.bookingStatus || '無'}
    - 最終匹配: ${check.finalMatch ? '✅' : '❌'} ${reasons.length > 0 ? `原因: ${reasons.join(', ')}` : ''}
            `.trim()
          }).join('\n')
        }
        
        const debugMessage = `
🔍 調試信息：

📥 請求參數:
- 日期: ${debugInfo.requestParams?.date || 'N/A'}
- 時間: ${debugInfo.requestParams?.startTime || 'N/A'} - ${debugInfo.requestParams?.endTime || 'N/A'}
- 遊戲: ${debugInfo.requestParams?.games || '無'}

📊 查詢結果:
- 找到開啟群組預約的夥伴: ${debugInfo.steps?.find((s: any) => s.step === '數據庫查詢結果')?.partnersFound || 0} 個
- 停權篩選後: ${debugInfo.steps?.find((s: any) => s.step === '停權篩選')?.partnersAfterSuspensionFilter || 0} 個

👥 夥伴詳情 (${debugInfo.partners?.length || 0} 個):
${debugInfo.partners?.map((p: any) => `
${p.partnerName || p.partnerId} (${p.partnerId}):
  狀態: ${p.finalStatus || '檢查中'}
  時段檢查:
${formatScheduleChecks(p)}
`).join('\n') || '無'}

🎯 最終匹配: ${debugInfo.finalResult?.partnersFound || 0} 個夥伴
        `.trim()
        
        console.log(debugMessage)
        
        // 如果沒有找到夥伴，顯示詳細原因
        if (partnersList.length === 0) {
          alert(`沒有找到符合條件的夥伴\n\n調試信息已輸出到瀏覽器控制台（按 F12 查看 Console）\n\n${debugMessage}`)
        }
      } else if (partnersList.length === 0) {
        // 沒有調試信息但沒有找到夥伴
        console.warn('⚠️ [多人陪玩搜索] 沒有找到夥伴，但沒有調試信息')
        console.log('💡 提示: 在 URL 中添加 ?debug=true 可啟用調試模式')
        alert('沒有找到符合條件的夥伴\n\n提示: 在 URL 中添加 ?debug=true 可查看詳細調試信息')
      }
      
      setPartners(partnersList)
      
      // 提取所有遊戲
      const gamesSet = new Set<string>()
      partnersList.forEach((partner: Partner) => {
        if (partner.games && Array.isArray(partner.games)) {
          partner.games.forEach(game => gamesSet.add(game))
        }
      })
      setAvailableGames(Array.from(gamesSet))
      
      if (partnersList.length === 0 && !debugMode) {
        alert('沒有找到符合條件的夥伴')
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
        alert('多人陪玩群組創建成功！')
        setSelectedPartners(new Set())
        setPartners([])
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

  // 打開重新選擇夥伴的模態框
  const openReplacePartnerModal = async (bookingId: string, multiPlayerBookingId: string) => {
    setReplacingBookingId(bookingId)
    setReplacingMultiPlayerBookingId(multiPlayerBookingId)
    
    // 找到對應的多人陪玩群組，獲取時間信息
    const booking = myBookings.find(b => b.id === multiPlayerBookingId)
    if (!booking) {
      alert('找不到對應的預約信息')
      return
    }

    // 設置搜索條件並搜索可用夥伴
    const bookingDate = new Date(booking.startTime)
    const dateStr = bookingDate.toISOString().split('T')[0]
    const startTimeStr = bookingDate.toTimeString().slice(0, 5)
    const endTimeStr = new Date(booking.endTime).toTimeString().slice(0, 5)

    setSelectedDate(dateStr)
    setSelectedStartTime(startTimeStr)
    setSelectedEndTime(endTimeStr)

    // 搜索可用夥伴
    try {
      setLoading(true)
      const params = new URLSearchParams({
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
      })

      const response = await fetch(`/api/partners/search-for-multi-player?${params}`)
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '搜尋失敗')
        return
      }

      const data = await response.json()
      const partnersList = Array.isArray(data.partners) ? data.partners : (data.partners || [])
      
      setReplacementPartners(partnersList)
      setSelectedReplacementPartner(null)
      setShowReplacePartnerModal(true)
    } catch (error) {
      console.error('搜尋夥伴失敗:', error)
      alert('搜尋失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 確認替換夥伴
  const confirmReplacePartner = async () => {
    if (!selectedReplacementPartner || !replacingBookingId || !replacingMultiPlayerBookingId) {
      alert('請選擇要替換的夥伴')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/multi-player-booking/${replacingMultiPlayerBookingId}/replace-partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejectedBookingId: replacingBookingId,
          newScheduleId: selectedReplacementPartner,
        }),
      })

      if (response.ok) {
        alert('夥伴已成功替換！')
        setShowReplacePartnerModal(false)
        setReplacingBookingId(null)
        setReplacingMultiPlayerBookingId(null)
        setSelectedReplacementPartner(null)
        setReplacementPartners([])
        loadMyBookings()
      } else {
        const error = await response.json()
        alert(error.error || '替換失敗')
      }
    } catch (error) {
      console.error('替換夥伴失敗:', error)
      alert('替換失敗，請重試')
    } finally {
      setLoading(false)
    }
  }

  // 取消整筆訂單
  const cancelEntireBooking = async (bookingId: string) => {
    if (!confirm('確定要取消整筆訂單嗎？已確認的夥伴將會收到通知。')) {
      return
    }

    try {
      setLoading(true)
      // 找到第一個 booking 來取消（取消 API 會處理整個多人陪玩群組）
      const booking = myBookings.find(b => b.id === bookingId)
      if (!booking || !booking.bookings || booking.bookings.length === 0) {
        alert('找不到對應的預約')
        return
      }

      // 使用第一個 booking 的 ID 來取消（API 會自動處理整個群組）
      const firstBookingId = booking.bookings[0].id
      const response = await fetch(`/api/bookings/${firstBookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: '顧客取消整筆訂單',
        }),
      })

      if (response.ok) {
        alert('訂單已成功取消！')
        loadMyBookings()
      } else {
        const error = await response.json()
        alert(error.error || '取消失敗')
      }
    } catch (error) {
      console.error('取消訂單失敗:', error)
      alert('取消失敗，請重試')
    } finally {
      setLoading(false)
    }
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
              <span className="text-2xl mr-3">⚠️</span>
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
                min={(() => {
                  // 使用台灣時區的今天日期作為最小值
                  const now = new Date();
                  const taipeiDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
                  const year = taipeiDate.getFullYear();
                  const month = String(taipeiDate.getMonth() + 1).padStart(2, '0');
                  const day = String(taipeiDate.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                })()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">開始時間</label>
              <select
                value={selectedStartTime}
                onChange={(e) => {
                  setSelectedStartTime(e.target.value)
                  setSelectedDuration(null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              >
                <option value="">請選擇</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const hour = Math.floor(i / 2)
                  const minute = (i % 2) * 30
                  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                  
                  // 檢查時段是否已經過去（使用台灣時區）
                  const now = new Date()
                  // 獲取台灣時區的今天日期
                  const taipeiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
                  const year = taipeiNow.getFullYear();
                  const month = String(taipeiNow.getMonth() + 1).padStart(2, '0');
                  const day = String(taipeiNow.getDate()).padStart(2, '0');
                  const today = `${year}-${month}-${day}`;
                  let isPast = false
                  
                  if (selectedDate) {
                    // 如果選擇的日期是過去，所有時段都禁用
                    if (selectedDate < today) {
                      isPast = true
                    } 
                    // 如果選擇的日期是今天，檢查該時段是否已過（使用台灣時區）
                    else if (selectedDate === today) {
                      const [timeHour, timeMinute] = timeStr.split(':').map(Number)
                      // 創建台灣時區的日期時間對象
                      const timeDateTaipei = new Date(taipeiNow);
                      timeDateTaipei.setHours(timeHour, timeMinute, 0, 0);
                      isPast = timeDateTaipei.getTime() < taipeiNow.getTime()
                    }
                  }
                  
                  return (
                    <option 
                      key={timeStr} 
                      value={timeStr}
                      disabled={isPast}
                      style={isPast ? { color: '#9CA3AF', backgroundColor: '#F3F4F6' } : {}}
                    >
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
                  setSelectedDuration(null)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              >
                <option value="">請選擇</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const hour = Math.floor(i / 2)
                  const minute = (i % 2) * 30
                  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                  
                  // 檢查時段是否已經過去
                  const now = new Date()
                  const today = now.toISOString().split('T')[0]
                  let isPast = false
                  
                  if (selectedDate) {
                    // 如果選擇的日期是過去，所有時段都禁用
                    if (selectedDate < today) {
                      isPast = true
                    } 
                    // 如果選擇的日期是今天，檢查該時段是否已過
                    else if (selectedDate === today) {
                      const [timeHour, timeMinute] = timeStr.split(':').map(Number)
                      const timeDate = new Date(now)
                      timeDate.setHours(timeHour, timeMinute, 0, 0)
                      isPast = timeDate.getTime() < now.getTime()
                    }
                    // 如果已選擇開始時間，結束時間必須晚於開始時間（跨日情況在後端處理，這裡只檢查是否已過期）
                    // 注意：跨日情況（如 23:30 到 00:00）在後端會正確處理，這裡不額外限制
                  }
                  
                  return (
                    <option 
                      key={timeStr} 
                      value={timeStr}
                      disabled={isPast}
                      style={isPast ? { color: '#9CA3AF', backgroundColor: '#F3F4F6' } : {}}
                    >
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {partners.map((partner) => {
                if (!partner.matchingSchedule || !partner.matchingSchedule.id) {
                  return null
                }
                const isSelected = selectedPartners.has(partner.matchingSchedule.id)
                
                // 轉換為 PartnerCard 需要的格式
                // 處理圖片：優先使用 images，如果沒有則使用 coverImage
                let images = partner.images || []
                if (images.length === 0 && partner.coverImage) {
                  images = [partner.coverImage]
                }
                // 如果有上分高手圖片，合併進去
                if (partner.isRankBooster && partner.rankBoosterImages?.length) {
                  images = [...images, ...partner.rankBoosterImages]
                }
                images = images.slice(0, 8)
                
                const partnerCardData = {
                  id: partner.id,
                  name: partner.name,
                  games: partner.games,
                  halfHourlyRate: partner.halfHourlyRate,
                  coverImage: partner.coverImage,
                  images: images,
                  schedules: [],
                  isAvailableNow: !!partner.isAvailableNow, // 確保是 boolean
                  isRankBooster: !!partner.isRankBooster, // 確保是 boolean
                  supportsChatOnly: partner.supportsChatOnly,
                  chatOnlyRate: partner.chatOnlyRate,
                  customerMessage: partner.customerMessage,
                  averageRating: partner.averageRating,
                  totalReviews: partner.totalReviews,
                }
                
                return (
                  <div
                    key={partner.id}
                    className={`relative transition-all ${
                      isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : ''
                    }`}
                    onClick={() => togglePartnerSelection(partner.matchingSchedule.id)}
                  >
                    <PartnerCard
                      partner={partnerCardData}
                      showNextStep={false}
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold z-40">
                        ✓
                      </div>
                    )}
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
                    onClick={() => setShowConfirmModal(true)}
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

        {/* 評論回饋區域 */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">💬 其他顧客的評論回饋</h2>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                        {review.reviewerName.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{review.reviewerName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                          ⭐
                        </span>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-gray-700 mt-2 mb-2">{review.comment}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(review.createdAt).toLocaleString('zh-TW', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
            </div>
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
                        狀態：{(() => {
                          const endTime = new Date(booking.endTime)
                          const now = new Date()
                          const isExpired = endTime.getTime() < now.getTime()
                          
                          // 如果時間已過，顯示為已完成
                          if (isExpired && (booking.status === 'ACTIVE' || booking.status === 'PENDING')) {
                            return '已完成'
                          }
                          
                          return booking.status === 'PENDING' ? '等待確認' : 
                                 booking.status === 'ACTIVE' ? '進行中' :
                                 booking.status === 'COMPLETED' ? '已完成' : '已取消'
                        })()}
                      </p>
                      <p className="text-sm text-gray-600">
                        總費用：${booking.totalAmount.toFixed(0)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {booking.bookings.map((b) => {
                      const isRejected = b.status === 'REJECTED' || b.status === 'PARTNER_REJECTED'
                      return (
                        <div
                          key={b.id}
                          className="relative flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full overflow-hidden relative">
                              <SecureImage
                                src={b.schedule.partner.coverImage}
                                alt={b.schedule.partner.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {b.schedule.partner.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                狀態：{b.status === 'CONFIRMED' || b.status === 'PARTNER_ACCEPTED' 
                                  ? '✓ 已確認' 
                                  : isRejected
                                  ? '✗ 已拒絕' 
                                  : b.status === 'CANCELLED'
                                  ? '已移除'
                                  : '等待確認'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {isRejected && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openReplacePartnerModal(b.id, booking.id)
                                }}
                                className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                              >
                                重新選擇
                              </button>
                            )}
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                ${b.originalAmount.toFixed(0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* 如果有拒絕的夥伴，顯示取消整筆按鈕 */}
                  {booking.bookings.some(b => b.status === 'REJECTED' || b.status === 'PARTNER_REJECTED') && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => cancelEntireBooking(booking.id)}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {loading ? '處理中...' : '取消整筆訂單'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 重新選擇夥伴模態框 */}
        {showReplacePartnerModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-white bg-opacity-80" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <div className="bg-white rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto border-2 border-purple-200 shadow-2xl relative">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-black">重新選擇夥伴</h2>
                <button
                  onClick={() => {
                    setShowReplacePartnerModal(false)
                    setReplacingBookingId(null)
                    setReplacingMultiPlayerBookingId(null)
                    setSelectedReplacementPartner(null)
                    setReplacementPartners([])
                  }}
                  className="text-gray-400 hover:text-gray-600 text-3xl font-light transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ×
                </button>
              </div>

              {replacementPartners.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-gray-600 text-lg font-medium">沒有找到可用的夥伴</p>
                  <p className="text-gray-400 text-sm mt-2">請嘗試調整搜尋條件或選擇其他時段</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      請選擇一位夥伴來替換被拒絕的夥伴
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    {replacementPartners.map((partner) => {
                      if (!partner.matchingSchedule || !partner.matchingSchedule.id) {
                        return null
                      }
                      const isSelected = selectedReplacementPartner === partner.matchingSchedule.id
                      
                      // 轉換為 PartnerCard 需要的格式
                      let images = partner.images || []
                      if (images.length === 0 && partner.coverImage) {
                        images = [partner.coverImage]
                      }
                      if (partner.isRankBooster && partner.rankBoosterImages?.length) {
                        images = [...images, ...partner.rankBoosterImages]
                      }
                      images = images.slice(0, 8)
                      
                      const partnerCardData = {
                        id: partner.id,
                        name: partner.name,
                        games: partner.games,
                        halfHourlyRate: partner.halfHourlyRate,
                        coverImage: partner.coverImage,
                        images: images,
                        schedules: [],
                        isAvailableNow: !!partner.isAvailableNow,
                        isRankBooster: !!partner.isRankBooster,
                        supportsChatOnly: partner.supportsChatOnly,
                        chatOnlyRate: partner.chatOnlyRate,
                        customerMessage: partner.customerMessage,
                        averageRating: partner.averageRating,
                        totalReviews: partner.totalReviews,
                      }
                      
                      return (
                        <div
                          key={partner.id}
                          className={`relative transition-all cursor-pointer ${
                            isSelected ? 'ring-2 ring-purple-500 ring-offset-2' : ''
                          }`}
                          onClick={() => setSelectedReplacementPartner(partner.matchingSchedule.id)}
                        >
                          <PartnerCard
                            partner={partnerCardData}
                            showNextStep={false}
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold z-40">
                              ✓
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowReplacePartnerModal(false)
                        setReplacingBookingId(null)
                        setReplacingMultiPlayerBookingId(null)
                        setSelectedReplacementPartner(null)
                        setReplacementPartners([])
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmReplacePartner}
                      disabled={!selectedReplacementPartner || loading}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? '處理中...' : '確認替換'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 確認創建多人陪玩 Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">確認創建多人陪玩</h2>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 預約時間 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">📅 預約時間</h3>
                    <p className="text-gray-700">
                      {selectedDate && (
                        <>
                          {new Date(selectedDate).toLocaleDateString('zh-TW', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </>
                      )}
                      {selectedStartTime && selectedEndTime && (
                        <span className="ml-2">
                          {selectedStartTime} - {selectedEndTime}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* 選擇的遊戲 */}
                  {selectedGames.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">🎮 選擇的遊戲</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedGames.map((game, index) => (
                          <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                            {game}
                          </span>
                        ))}
                        {otherGame && otherGame.trim() && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                            {otherGame.trim()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 選擇的夥伴 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">👥 選擇的夥伴 ({selectedPartners.size} 位)</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {Array.from(selectedPartners).map((scheduleId) => {
                        const partner = partners.find(p => p.matchingSchedule.id === scheduleId)
                        if (!partner) return null
                        const durationHours = (new Date(partner.matchingSchedule.endTime).getTime() - 
                                             new Date(partner.matchingSchedule.startTime).getTime()) / (1000 * 60 * 60)
                        const amount = durationHours * partner.halfHourlyRate * 2
                        return (
                          <div key={scheduleId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              {partner.coverImage && (
                                <SecureImage
                                  src={partner.coverImage}
                                  alt={partner.name}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{partner.name}</p>
                                <p className="text-sm text-gray-600">
                                  {new Date(partner.matchingSchedule.startTime).toLocaleTimeString('zh-TW', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })} - {new Date(partner.matchingSchedule.endTime).toLocaleTimeString('zh-TW', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </p>
                              </div>
                            </div>
                            <p className="font-semibold text-gray-900">${amount.toFixed(0)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 總費用 */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">總費用：</span>
                      <span className="text-2xl font-bold text-purple-600">
                        ${calculateTotalAmount().toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* 提示訊息 */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ 請確認以上資訊無誤，創建後將無法修改。夥伴確認後，Discord 頻道建立即視為服務已開始。
                    </p>
                  </div>
                </div>

                {/* 按鈕 */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmModal(false)
                      createMultiPlayerBooking()
                    }}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 font-medium"
                  >
                    {loading ? '創建中...' : '確認創建'}
                  </button>
                </div>
              </div>
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

