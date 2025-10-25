'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react'
import Image from 'next/image'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import PartnerCard from '@/components/PartnerCard'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// 動態步驟顯示
const getSteps = (onlyAvailable: boolean) => {
  if (onlyAvailable) {
    return [
      '選擇夥伴',
      '選擇時長',
      '確認預約',
      '完成'
    ]
  } else {
    return [
      '選擇夥伴',
      '選擇日期',
      '選擇時段',
      '確認預約',
      '完成'
    ]
  }
}

export type Partner = {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
  images?: string[]; // 新增多張圖片支援
  schedules: { 
    id: string; 
    date: string; 
    startTime: string; 
    endTime: string; 
    isAvailable: boolean;
    bookings?: { status: string } | null;
    searchTimeRestriction?: {
      startTime: string;
      endTime: string;
      startDate: string;
      endDate: string;
    };
  }[];
  isAvailableNow: boolean;
  isRankBooster: boolean;
  customerMessage?: string;
  averageRating?: number;
  totalReviews?: number;
};

// 工具函式：判斷兩個日期是否同一天（本地時區）
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function BookingWizardContent() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [onlyRankBooster, setOnlyRankBooster] = useState(false)
  const [instantBooking, setInstantBooking] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [selectedDuration, setSelectedDuration] = useState<number>(1) // 新增：預約時長（小時）
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set())
  const [promoCode, setPromoCode] = useState('')
  const [promoCodeResult, setPromoCodeResult] = useState<any>(null)
  const [promoCodeError, setPromoCodeError] = useState('')
  const [isValidatingPromoCode, setIsValidatingPromoCode] = useState(false)
  const { data: session } = useSession()
  // 移除金幣相關狀態
  const [creating, setCreating] = useState(false)
  const [createdBooking, setCreatedBooking] = useState<any>(null)
  
  // 防抖搜尋
  const debouncedSearch = useDebounce(search, 300)

  // 處理翻面功能
  const handleCardFlip = (partnerId: string) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partnerId)) {
        newSet.delete(partnerId);
      } else {
        newSet.add(partnerId);
      }
      return newSet;
    });
  };

  // 驗證優惠碼
  const validatePromoCode = async () => {
    if (!promoCode.trim() || !selectedPartner) return;

    setIsValidatingPromoCode(true);
    setPromoCodeError('');

    try {
      const originalAmount = onlyAvailable 
        ? (selectedDuration * selectedPartner.halfHourlyRate * 2).toFixed(0)
        : selectedTimes.length * selectedPartner.halfHourlyRate;

      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), amount: originalAmount })
      });

      const data = await res.json();

      if (res.ok) {
        setPromoCodeResult(data);
        setPromoCodeError('');
      } else {
        setPromoCodeError(data.error || '優惠碼驗證失敗');
        setPromoCodeResult(null);
      }
    } catch (error) {
      setPromoCodeError('優惠碼驗證失敗');
      setPromoCodeResult(null);
    } finally {
      setIsValidatingPromoCode(false);
    }
  };

  // 移除無用的金幣餘額獲取

  // 處理 URL 參數
  useEffect(() => {
    const partnerId = searchParams.get('partnerId')
    if (partnerId && partners.length > 0) {
      const partner = partners.find(p => p.id === partnerId)
      if (partner) {
        setSelectedPartner(partner)
        setStep(1) // 直接跳到選擇日期步驟
      }
    }
  }, [searchParams, partners])

  // 優化夥伴資料獲取
  useEffect(() => {
    const fetchPartners = async () => {
      setLoading(true)
      try {
        let url = '/api/partners';
        const params = [];
        if (onlyAvailable) params.push('availableNow=true');
        if (onlyRankBooster) params.push('rankBooster=true');
        
        // 只查詢未來7天，減少資料傳輸量，加快載入速度
        const now = new Date();
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天後
        params.push(`startDate=${now.toISOString()}`);
        params.push(`endDate=${endDate.toISOString()}`);
        
        if (params.length > 0) url += '?' + params.join('&');
        
        const res = await fetch(url)
        if (!res.ok) {
          setPartners([])
          return
        }
        
        const data = await res.json()
        if (Array.isArray(data)) {
          setPartners(data)
        } else {
          setPartners([])
        }
      } catch (error) {
        console.error("Failed to fetch partners:", error)
        setPartners([])
      } finally {
        setLoading(false)
      }
    }

    fetchPartners()
  }, [onlyAvailable, onlyRankBooster])

  // 搜尋過濾 - 使用 useMemo 優化，使用防抖搜尋
  const filteredPartners: Partner[] = useMemo(() => {
    return partners.filter(p => {
      const matchSearch = p.name.includes(debouncedSearch) || (p.games && p.games.some(s => s.includes(debouncedSearch)));
      
      if (!matchSearch) return false;
      
      if (onlyAvailable && onlyRankBooster) {
        return p.isAvailableNow && p.isRankBooster;
      } else if (onlyAvailable) {
        return p.isAvailableNow;
      } else if (onlyRankBooster) {
        return p.isRankBooster;
      } else {
        return true;
      }
    });
  }, [partners, debouncedSearch, onlyAvailable, onlyRankBooster]);

  const handleTimeSelect = useCallback((timeId: string) => {
    setSelectedTimes(prev => 
      prev.includes(timeId) 
        ? prev.filter(t => t !== timeId)
        : [...prev, timeId]
    )
  }, [])

  // 優化日期選擇邏輯
  const availableDates = useMemo(() => {
    if (!selectedPartner) return []
    const dateSet = new Set<string>()
    const now = new Date();
    selectedPartner.schedules.forEach(s => {
      if (!s.isAvailable) return;
      if (new Date(s.startTime) <= now) return;
      const d = new Date(s.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      dateSet.add(key)
    })
    return Array.from(dateSet).map(key => {
      const [year, month, date] = key.split('-').map(Number)
      return new Date(year, month, date).getTime()
    }).sort((a, b) => a - b)
  }, [selectedPartner])

  // 優化時段選擇邏輯
  const availableTimeSlots = useMemo(() => {
    if (!selectedPartner || !selectedDate) return []
    const seenTimeSlots = new Set<string>()
    const now = new Date();
    const uniqueSchedules = selectedPartner.schedules.filter(schedule => {
      // 檢查時段是否可用（排除已取消的預約）
      if (!schedule.isAvailable) return false;
      
      // 如果有預約記錄且狀態不是 CANCELLED 或 REJECTED，則時段不可用
      if (schedule.bookings && schedule.bookings.status !== 'CANCELLED' && schedule.bookings.status !== 'REJECTED') return false;
      
      const scheduleDate = new Date(schedule.date)
      if (!isSameDay(scheduleDate, selectedDate)) return false;
      if (new Date(schedule.startTime) <= now) return false;
      
      // 如果有搜尋時段限制，檢查時段是否與搜尋時段重疊
      if (schedule.searchTimeRestriction) {
        const restriction = schedule.searchTimeRestriction;
        const scheduleStart = schedule.startTime;
        const scheduleEnd = schedule.endTime;
        const searchStart = restriction.startTime;
        const searchEnd = restriction.endTime;
        
        // 檢查時段是否與搜尋時段重疊
        if (scheduleEnd <= searchStart || scheduleStart >= searchEnd) {
          return false;
        }
      }
      
      const timeSlotIdentifier = `${schedule.startTime}-${schedule.endTime}`
      if (seenTimeSlots.has(timeSlotIdentifier)) {
        return false
      }
      seenTimeSlots.add(timeSlotIdentifier)
      return true
    })
    return uniqueSchedules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [selectedPartner, selectedDate])

  // 計算所需金幣
  const calculateRequiredCoins = () => {
    if (onlyAvailable && selectedDuration && selectedPartner?.halfHourlyRate) {
      return Math.ceil(selectedDuration * selectedPartner.halfHourlyRate * 2)
    } else if (selectedTimes.length > 0 && selectedPartner?.halfHourlyRate) {
      return Math.ceil(selectedTimes.length * selectedPartner.halfHourlyRate)
    }
    return 0
  }

  const requiredCoins = calculateRequiredCoins()
  const hasEnoughCoins = true // 暫時移除金幣檢查，直接設為 true

  // 修改確認預約函數
  const handleCreateBooking = async () => {
    // 暫時移除金幣檢查
    // if (!hasEnoughCoins) {
    //   alert(`金幣不足！需要 ${requiredCoins} 金幣，當前餘額 ${userCoins} 金幣`)
    //   return
    // }

    try {
      setCreating(true)
      
              if (onlyAvailable && selectedPartner) {
          // 即時預約
          const response = await fetch('/api/bookings/instant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partnerId: selectedPartner.id,
              duration: selectedDuration
            })
          })

        if (!response.ok) {
          const errorData = await response.json()
          if (errorData.error === '金幣不足') {
            alert(`金幣不足！需要 ${errorData.required} 金幣，當前餘額 ${errorData.current} 金幣`)
            return
          }
          throw new Error(errorData.error || '預約創建失敗')
        }

        const data = await response.json()
        setCreatedBooking(data.booking)
        // 移除金幣餘額更新
        setStep(onlyAvailable ? 3 : 4) // 跳到完成步驟
      } else {
        // 一般預約 - 需要先獲取 scheduleIds
        if (!selectedTimes || selectedTimes.length === 0) {
          alert('請先選擇預約時段')
          return
        }
        
        // 獲取選中時段的 scheduleIds
        const scheduleIds = selectedTimes.map(time => {
          // 從時間字串中提取 scheduleId
          // 格式: "scheduleId|startTime|endTime"
          return time.split('|')[0]
        }).filter(id => id)
        
        if (scheduleIds.length === 0) {
          alert('無法獲取時段資訊，請重新選擇')
          return
        }
        
        // 發送一般預約請求
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduleIds })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || '預約創建失敗')
        }
        
        const data = await response.json()
        setCreatedBooking(data)
        setStep(4) // 跳到完成步驟
      }
    } catch (error) {
      console.error('預約創建失敗:', error)
      alert(error instanceof Error ? error.message : '預約創建失敗，請重試')
    } finally {
      setCreating(false)
    }
  }

  const handlePartnerSelect = useCallback((partner: Partner) => {
    setSelectedPartner(partner)
    setSelectedDate(null)
    setSelectedTimes([])
    setSelectedDuration(1) // 重置預約時長
    if (onlyAvailable) {
      setStep(1) // 直接跳到選擇時長步驟
    }
  }, [onlyAvailable])

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    setSelectedTimes([])
  }, [])

  const handleNextStep = useCallback(() => {
    setStep(prev => prev + 1)
  }, [])

  const handlePrevStep = useCallback(() => {
    setStep(prev => prev - 1)
  }, [])

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return selectedPartner !== null
      case 1: return onlyAvailable ? selectedDuration > 0 : selectedDate !== null
      case 2: return onlyAvailable ? true : selectedTimes.length > 0
      default: return true
    }
  }, [step, selectedPartner, selectedDate, selectedTimes, selectedDuration, onlyAvailable])

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{backgroundColor: '#E4E7EB'}}>

      {/* Hero Section */}
      <div className="relative py-16 px-6 overflow-hidden">
        {/* 背景漸層 */}
        <div className="absolute inset-0 bg-gradient-to-br from-#1A73E8 via-#5C7AD6 to-#1A73E8 opacity-95"></div>
        
        {/* 幾何裝飾元素 */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6" style={{color: 'white'}}>
            預約陪玩服務
          </h1>
          <div className="w-24 h-1 mx-auto mb-6" style={{backgroundColor: '#5C7AD6'}}></div>
          <p className="text-xl max-w-3xl mx-auto" style={{color: 'white', opacity: 0.95}}>
            選擇專業夥伴，享受優質的遊戲陪玩體驗
          </p>
        </div>
      </div>

      <div className="py-8 px-6 w-full">
        <div className="max-w-6xl mx-auto w-full">
          <div className="rounded-3xl p-8" style={{backgroundColor: 'white', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'}}>
          {/* 步驟指示器 */}
          <div className="mb-16">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-8 right-8 h-2 -z-10 rounded-full" style={{
                backgroundColor: '#E4E7EB'
              }} />
              {getSteps(onlyAvailable).map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center">
                  <div className={`w-16 h-16 flex items-center justify-center rounded-2xl border-2 transition-all duration-300 text-lg font-bold
                    ${i < step ? 'shadow-lg' :
                      i === step ? 'shadow-xl scale-110' :
                      ''}`}
                    style={{
                      background: i <= step ? 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)' : 'white',
                      borderColor: i <= step ? '#1A73E8' : '#E4E7EB',
                      color: i <= step ? 'white' : '#333140'
                    }}
                  >
                    {i+1}
                  </div>
                  <div className={`mt-4 text-lg text-center font-medium ${i === step ? 'font-bold' : ''}`} style={{
                    color: i === step ? '#1A73E8' : '#333140',
                    opacity: i === step ? 1 : 0.7
                  }}>
                    {s}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 步驟內容 */}
          <div className="min-h-[400px] transition-all duration-300">
        {step === 0 && (
          <div className="px-4 sm:px-10 pb-10">
            {/* 篩選器和搜尋 - 改為響應式橫向排列 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6">
              {/* 篩選器 - 手機上橫向排列 */}
              <div className="flex gap-3 sm:gap-4 w-full sm:w-auto">
                <label className="flex items-center gap-2 text-white text-sm select-none cursor-pointer">
                  <input
                    id="only-available"
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={e => setOnlyAvailable(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4 sm:w-5 sm:h-5"
                  />
                  <span className="text-xs sm:text-sm text-gray-900 font-bold">只看現在有空</span>
                </label>
                <label className="flex items-center gap-2 text-gray-900 text-sm select-none cursor-pointer">
                  <input
                    id="only-rank-booster"
                    type="checkbox"
                    checked={onlyRankBooster}
                    onChange={e => setOnlyRankBooster(e.target.checked)}
                    className="accent-purple-500 w-4 h-4 sm:w-5 sm:h-5"
                  />
                  <span className="text-xs sm:text-sm text-gray-900 font-bold">只看上分高手</span>
                </label>
              </div>
              
              {/* 搜尋框 - 手機上獨占一行 */}
              <input
                className="w-full sm:flex-1 px-3 sm:px-4 py-2 rounded-full bg-palette-400 text-palette-900 border border-palette-600 focus:outline-none focus:ring-2 focus:ring-palette-700 focus:border-transparent placeholder-palette-600 text-sm sm:text-base shadow-sm"
                placeholder="搜尋夥伴姓名或專長..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* 群組預約按鈕 */}
            <div className="mb-6 text-center">
              <a
                href="/booking/group"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <span className="text-lg">🎮</span>
                <span className="font-medium">群組預約</span>
                <span className="text-sm opacity-90">與其他玩家一起預約</span>
              </a>
            </div>
            
            {/* 載入狀態 */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                <p className="text-gray-600 text-sm">載入夥伴資料中...</p>
              </div>
            ) : (
              /* 夥伴卡片網格 - 改善手機版佈局 */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {filteredPartners.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 text-gray-600 text-center py-8">
                    {search ? '搜尋無結果' : '查無夥伴'}
                  </div>
                )}
                {filteredPartners.map(p => (
                  <div key={p.id} className="mb-4 relative group">
                    <div
                      className={`transition-all duration-200 rounded-2xl border-2 
                        ${selectedPartner?.id === p.id 
                          ? 'border-transparent ring-4 ring-indigo-400/60 ring-offset-2 shadow-2xl scale-105 bg-[#1e293b]/40' 
                          : 'border-transparent hover:ring-2 hover:ring-indigo-300/40 hover:scale-102'} 
                        cursor-pointer`}
                      style={{ boxShadow: selectedPartner?.id === p.id ? '0 0 0 4px #818cf8, 0 8px 32px 0 rgba(55,48,163,0.15)' : undefined }}
                      onClick={() => {
                        setSelectedPartner(p);
                      }}
                    >
                      <PartnerCard
                        partner={p}
                        flipped={flippedCards.has(p.id)}
                        onFlip={() => handleCardFlip(p.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!onlyAvailable && step === 1 && selectedPartner && (
          <div>
            <div className="text-lg text-white/90 mb-4 text-center">（2）選擇日期</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableDates.map(ts => {
                  const d = new Date(ts);
                  const label = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
                  const isSelected = selectedDate && d.getTime() === selectedDate.getTime();
                  return (
                    <button
                      key={ts}
                      onClick={() => handleDateSelect(d)}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                        ${isSelected 
                          ? 'shadow-lg scale-105' 
                          : 'hover:shadow-md'}`}
                      style={{
                        backgroundColor: isSelected ? '#1A73E8' : 'white',
                        color: isSelected ? 'white' : '#333140',
                        borderColor: '#E4E7EB',
                        border: '1px solid #E4E7EB'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
        {onlyAvailable && step === 1 && selectedPartner && (
          <div>
            <div className="text-lg text-gray-900 font-bold mb-4">（2）選擇預約時長</div>
            <div className="text-sm text-gray-700 mb-6 text-center">
              選擇您想要預約的時長，系統會自動安排最適合的時間
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(duration => (
                <button
                  key={duration}
                  onClick={() => setSelectedDuration(duration)}
                  className={`px-4 py-3 border-2 border-black transition-all duration-200 text-sm font-medium
                    ${selectedDuration === duration 
                      ? 'bg-black text-white shadow-lg scale-105' 
                      : 'bg-white text-black hover:bg-gray-100'}`}
                  style={{
                    backgroundColor: selectedDuration === duration ? 'black' : 'white',
                    color: selectedDuration === duration ? 'white' : 'black',
                    borderColor: 'black'
                  }}
                >
                  {duration === 0.5 ? '30分鐘' : duration === 1 ? '1小時' : `${duration}小時`}
                </button>
              ))}
            </div>
            <div className="mt-4 text-center text-sm text-gray-900 font-medium">
               費用：${(selectedDuration * selectedPartner.halfHourlyRate * 2).toFixed(0)} (${selectedPartner.halfHourlyRate}/半小時)
             </div>
          </div>
        )}
        {!onlyAvailable && step === 2 && selectedPartner && selectedDate && (
          <div>
            <div className="text-lg text-white/90 mb-4 text-center">（3）選擇時段</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableTimeSlots.length === 0 ? (
                <div className="text-gray-600 text-center py-8">
                  該日期沒有可預約的時段
                </div>
              ) : (
                availableTimeSlots.map(schedule => {
                  const startTime = new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const endTime = new Date(schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isSelected = selectedTimes.includes(schedule.id);
                  return (
                    <button
                      key={schedule.id}
                      onClick={() => handleTimeSelect(schedule.id)}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                        ${isSelected 
                          ? 'shadow-lg scale-105' 
                          : 'hover:shadow-md'}`}
                      style={{
                        backgroundColor: isSelected ? '#00BFA5' : 'white',
                        color: isSelected ? 'white' : '#333140',
                        borderColor: '#E4E7EB',
                        border: '1px solid #E4E7EB'
                      }}
                    >
                      {startTime} - {endTime}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        {((onlyAvailable && step === 2) || (!onlyAvailable && step === 3)) && selectedPartner && (
          <div>
            <div className="text-lg text-gray-900 mb-4 text-center">（3）確認預約</div>
            <div className="bg-palette-500 rounded-lg p-6 mb-6 border border-palette-600">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-palette-700 flex items-center justify-center text-white font-bold">
                  {selectedPartner.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{selectedPartner.name}</h3>
                  <p className="text-gray-600 text-sm">{selectedPartner.games.join(', ')}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {onlyAvailable ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-medium">預約時長：</span>
                    <span className="text-gray-900 font-bold">
                      {selectedDuration === 0.5 ? '30分鐘' : selectedDuration === 1 ? '1小時' : `${selectedDuration}小時`}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-medium">選擇日期：</span>
                    <span className="text-gray-900 font-bold">
                      {selectedDate ? `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}` : '未選擇'}
                    </span>
                  </div>
                )}
                
                {!onlyAvailable && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-medium">選擇時段：</span>
                    <span className="text-gray-900 font-bold">{selectedTimes.length} 個時段</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-900 font-medium">總費用：</span>
                  <span className="text-gray-900 font-bold text-lg">
                    ${onlyAvailable 
                      ? (selectedDuration * selectedPartner.halfHourlyRate * 2).toFixed(0)
                      : selectedTimes.length * selectedPartner.halfHourlyRate
                    }
                  </span>
                </div>

                {/* 優惠碼輸入 */}
                <div className="border-t border-gray-600 pt-4 mt-4">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="輸入優惠碼"
                      className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={validatePromoCode}
                      disabled={!promoCode.trim() || isValidatingPromoCode}
                      className="px-4 py-2 bg-palette-800 text-white rounded hover:bg-palette-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isValidatingPromoCode ? '驗證中...' : '驗證'}
                    </button>
                  </div>
                  
                  {promoCodeError && (
                    <p className="text-red-400 text-sm">{promoCodeError}</p>
                  )}
                  
                  {promoCodeResult && (
                    <div className="bg-green-900/30 border border-green-500 rounded p-3">
                      <p className="text-green-400 text-sm font-medium">
                        ✅ 優惠碼已應用：{promoCodeResult.promoCode.code}
                      </p>
                      <p className="text-green-300 text-xs">
                        折扣：-${promoCodeResult.discountAmount}
                      </p>
                      <p className="text-white text-sm font-bold">
                        最終費用：${promoCodeResult.finalAmount}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
                <button
                  onClick={handlePrevStep}
                  className="px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
                  style={{
                    backgroundColor: 'white',
                    color: '#333140',
                    border: '2px solid #E4E7EB'
                  }}
                >
                  上一步
                </button>
                <button
                  onClick={handleCreateBooking}
                  disabled={creating}
                  className="px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#00BFA5',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(0, 191, 165, 0.3)'
                  }}
                >
                  {creating ? '處理中...' : '確認預約'}
                </button>
            </div>
          </div>
        )}
                         {/* 付款步驟暫時移除
        {((onlyAvailable && step === 3) || (!onlyAvailable && step === 4)) && (
          <div className="text-center">
            <div className="text-lg text-white/90 mb-4 text-center">（5）付款</div>
            <div className="text-6xl mb-4">💳</div>
            <p className="text-gray-600 mb-4">請在新視窗中完成付款</p>
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mt-4">
              <p className="text-yellow-300 text-sm">
                ⚠️ 重要：請在新開啟的付款頁面中完成付款，付款完成後預約才會生效。
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setStep(onlyAvailable ? 2 : 3)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                回到確認頁面
              </button>
            </div>
          </div>
        )}
        */}
                                   {((onlyAvailable && step === 3) || (!onlyAvailable && step === 4)) && (
           <div className="text-center">
                           <div className="text-lg text-white/90 mb-4 text-center">（4）完成</div>
             <div className="text-6xl mb-4">✅</div>
                           <p className="text-gray-600 mb-4">預約已確認，等待夥伴確認即可。</p>
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mt-4">
                <p className="text-green-300 text-sm">
                  🎉 恭喜！您的預約已成功建立。
                </p>
                {onlyAvailable && (
                  <p className="text-blue-300 text-sm mt-2">
                    ⏰ 即時預約：Discord 頻道將在夥伴確認後 3 分鐘自動開啟
                  </p>
                )}
              </div>
           </div>
         )}
      </div>

          {/* 導航按鈕 */}
          {((onlyAvailable && step < 2) || (!onlyAvailable && step < 3)) && (
            <div className="flex justify-between gap-6 mt-12">
              <button
                onClick={handlePrevStep}
                disabled={step === 0}
                className="px-10 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: 'white',
                  color: '#333140',
                  border: '2px solid #E4E7EB',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                }}
              >
                上一步
              </button>
              <button
                onClick={handleNextStep}
                disabled={!canProceed}
                className="px-10 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                  color: 'white',
                  boxShadow: '0 8px 32px rgba(26, 115, 232, 0.3)'
                }}
              >
                下一步
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BookingWizard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    }>
      <BookingWizardContent />
    </Suspense>
  )
} 