'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react'
import Image from 'next/image'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import PartnerCard from '@/components/PartnerCard'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

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
  }[];
  isAvailableNow: boolean;
  isRankBooster: boolean;
  customerMessage?: string;
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
  const [userCoins, setUserCoins] = useState(0)
  const [loadingCoins, setLoadingCoins] = useState(true)
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

  // 獲取用戶金幣餘額
  useEffect(() => {
    const fetchUserCoins = async () => {
      try {
        const response = await fetch('/api/user/coins')
        if (response.ok) {
          const data = await response.json()
          setUserCoins(data.coinBalance)
        }
      } catch (error) {
        console.error('獲取金幣餘額失敗:', error)
      } finally {
        setLoadingCoins(false)
      }
    }

    if (session?.user?.id) {
      fetchUserCoins()
    }
  }, [session])

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
        
        // 傳遞更寬的日期範圍，確保能獲取到足夠的時段資料
        const now = new Date();
        const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天後
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
        setUserCoins(data.newBalance) // 更新金幣餘額
        setStep(onlyAvailable ? 3 : 4) // 跳到完成步驟
      } else {
        // 一般預約 - 需要先獲取 scheduleIds
        if (!selectedTimes || selectedTimes.length === 0) {
          alert('請先選擇預約時段')
          return
        }
        
        // 暫時停用一般預約，因為需要完整的時段選擇邏輯
        alert('一般預約功能正在優化中，請使用「現在有空」功能進行即時預約')
        return
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
    <div className="max-w-2xl mx-auto mt-36 rounded-3xl p-0 shadow-2xl bg-[#1e293b]/80 backdrop-blur-lg border border-white/10 overflow-hidden">
      {/* 顯示金幣餘額 */}
      {/* 暫時移除金幣餘額顯示 */}
      {/* <div className="fixed top-4 right-4 bg-indigo-600 px-4 py-2 rounded-lg shadow-lg z-50">
        <div className="flex items-center space-x-2">
          <span className="text-yellow-400 text-xl">🪙</span>
          <span className="font-semibold">{loadingCoins ? '...' : userCoins}</span>
          <span className="text-sm text-indigo-200">金幣</span>
        </div>
      </div> */}

      {/* 步驟指示器 */}
      <div className="px-4 sm:px-10 pt-6 sm:pt-10 pb-4 sm:pb-6 bg-[#334155]/20">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-4 sm:left-6 right-4 sm:right-6 h-1 bg-[#475569]/30 -z-10 rounded-full" style={{transform:'translateY(-50%)'}} />
          {getSteps(onlyAvailable).map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border-2 transition-all duration-300 text-xs sm:text-sm
                ${i < step ? 'bg-[#6366f1] border-[#6366f1] text-white shadow-lg' :
                  i === step ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white shadow-xl scale-110' :
                  'bg-gray-800 border-gray-600 text-gray-400'}`}>{i+1}</div>
              <div className={`mt-1 sm:mt-2 text-xs ${i === step ? 'text-indigo-300 font-bold' : 'text-gray-400'}`}>
                <span className="hidden sm:inline">{s}</span>
                <span className="sm:hidden">{s.split(' ')[1] || s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 步驟內容 */}
      <div className="min-h-[200px] flex flex-col items-center justify-center px-10 py-12 transition-all duration-300 animate-fadein">
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
                  <span className="text-xs sm:text-sm">只看現在有空</span>
                </label>
                <label className="flex items-center gap-2 text-white text-sm select-none cursor-pointer">
                  <input
                    id="only-rank-booster"
                    type="checkbox"
                    checked={onlyRankBooster}
                    onChange={e => setOnlyRankBooster(e.target.checked)}
                    className="accent-purple-500 w-4 h-4 sm:w-5 sm:h-5"
                  />
                  <span className="text-xs sm:text-sm">只看上分高手</span>
                </label>
              </div>
              
              {/* 搜尋框 - 手機上獨占一行 */}
              <input
                className="w-full sm:flex-1 px-3 sm:px-4 py-2 rounded-full bg-gray-900/80 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400 text-sm sm:text-base"
                placeholder="搜尋夥伴姓名或專長..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            {/* 載入狀態 */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                <p className="text-gray-400 text-sm">載入夥伴資料中...</p>
              </div>
            ) : (
              /* 夥伴卡片網格 - 改善手機版佈局 */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {filteredPartners.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 text-gray-400 text-center py-8">
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
            <div className="text-lg text-white/90 mb-4">（2）選擇日期</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableDates.map(ts => {
                  const d = new Date(ts);
                  const label = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
                  const isSelected = selectedDate && d.getTime() === selectedDate.getTime();
                  return (
                    <button
                      key={ts}
                      onClick={() => handleDateSelect(d)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 text-sm font-medium
                        ${isSelected 
                          ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg scale-105' 
                          : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500'}`}
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
            <div className="text-lg text-white/90 mb-4">（2）選擇預約時長</div>
            <div className="text-sm text-gray-400 mb-6 text-center">
              選擇您想要預約的時長，系統會自動安排最適合的時間
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(duration => (
                <button
                  key={duration}
                  onClick={() => setSelectedDuration(duration)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium
                    ${selectedDuration === duration 
                      ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg scale-105' 
                      : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500'}`}
                >
                  {duration === 0.5 ? '30分鐘' : duration === 1 ? '1小時' : `${duration}小時`}
                </button>
              ))}
            </div>
                         <div className="mt-4 text-center text-sm text-gray-400">
               費用：{(selectedDuration * selectedPartner.halfHourlyRate * 2).toFixed(0)}金幣 ({selectedPartner.halfHourlyRate}金幣/半小時)
             </div>
          </div>
        )}
        {!onlyAvailable && step === 2 && selectedPartner && selectedDate && (
          <div>
            <div className="text-lg text-white/90 mb-4">（3）選擇時段</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableTimeSlots.length === 0 ? (
                <div className="text-gray-400 text-center py-8">
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
                      className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 text-sm font-medium
                        ${isSelected 
                          ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg scale-105' 
                          : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500'}`}
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
            <div className="text-lg text-white/90 mb-4">（3）確認預約</div>
            <div className="bg-gray-800/30 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                  {selectedPartner.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{selectedPartner.name}</h3>
                  <p className="text-gray-400 text-sm">{selectedPartner.games.join(', ')}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {onlyAvailable ? (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">預約時長：</span>
                    <span className="text-white font-medium">
                      {selectedDuration === 0.5 ? '30分鐘' : selectedDuration === 1 ? '1小時' : `${selectedDuration}小時`}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">選擇日期：</span>
                    <span className="text-white font-medium">
                      {selectedDate ? `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}` : '未選擇'}
                    </span>
                  </div>
                )}
                
                {!onlyAvailable && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">選擇時段：</span>
                    <span className="text-white font-medium">{selectedTimes.length} 個時段</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">總費用：</span>
                  <span className="text-white font-bold text-lg">
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
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                上一步
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={creating}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? '處理中...' : '確認預約'}
              </button>
            </div>
          </div>
        )}
                         {/* 付款步驟暫時移除
        {((onlyAvailable && step === 3) || (!onlyAvailable && step === 4)) && (
          <div className="text-center">
            <div className="text-lg text-white/90 mb-4">（5）付款</div>
            <div className="text-6xl mb-4">💳</div>
            <p className="text-gray-400 mb-4">請在新視窗中完成付款</p>
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
                           <div className="text-lg text-white/90 mb-4">（4）完成</div>
             <div className="text-6xl mb-4">✅</div>
                           <p className="text-gray-400 mb-4">預約已確認，等待夥伴確認即可。</p>
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
        <div className="px-10 pb-10 flex justify-between">
          <button
            onClick={handlePrevStep}
            disabled={step === 0}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一步
          </button>
          <button
            onClick={handleNextStep}
            disabled={!canProceed}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一步
          </button>
        </div>
      )}
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