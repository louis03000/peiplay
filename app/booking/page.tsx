'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react'
import Image from 'next/image'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import PartnerCard from '@/components/PartnerCard'
import { useSearchParams } from 'next/navigation'

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

const steps = [
  '選擇夥伴',
  '選擇日期',
  '選擇時段',
  '確認預約',
  '付款',
  '完成'
]

export type Partner = {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
  images?: string[]; // 新增多張圖片支援
  schedules: { id: string; date: string; startTime: string; endTime: string, isAvailable: boolean }[];
  isAvailableNow: boolean;
  isRankBooster: boolean;
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
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // 防抖搜尋
  const debouncedSearch = useDebounce(search, 300)

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
      if (!schedule.isAvailable) return false;
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

  const handleCreateBooking = useCallback(async () => {
    if (!selectedPartner || selectedTimes.length === 0 || isProcessing) return;

    setIsProcessing(true)
    try {
      // 1. 創建預約
      const bookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleIds: selectedTimes }),
      });

      if (!bookingRes.ok) {
        const errorData = await bookingRes.json();
        throw new Error(errorData.error || '預約失敗，請重試');
      }

      const bookingData = await bookingRes.json();
      const bookingId = bookingData.id;
      const totalAmount = selectedTimes.length * selectedPartner.halfHourlyRate;

      // 2. 創建付款請求
      const paymentRes = await fetch('/api/payment/ecpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingId,
          amount: totalAmount,
          description: `${selectedPartner.name} - ${selectedTimes.length} 個時段`,
          customerName: 'PeiPlay 用戶',
          customerEmail: 'user@peiplay.com'
        }),
      });

      if (!paymentRes.ok) {
        const errorData = await paymentRes.json();
        throw new Error(errorData.error || '付款建立失敗，請重試');
      }

      const paymentData = await paymentRes.json();

      // 3. 跳轉到付款頁面
      setStep(4); // 顯示付款跳轉頁面

      // 4. 延遲後跳轉到綠界付款頁面
      setTimeout(() => {
        // 創建表單並提交到綠界
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentData.paymentUrl;
        form.target = '_blank';

        // 添加所有參數
        Object.entries(paymentData.params).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        // 跳轉到完成頁面
        setStep(5);
      }, 2000);

    } catch (err) {
      alert(err instanceof Error ? err.message : '預約失敗，請重試');
      setStep(3); // 回到確認頁面
    } finally {
      setIsProcessing(false)
    }
  }, [selectedPartner, selectedTimes, isProcessing]);

  const handlePartnerSelect = useCallback((partner: Partner) => {
    setSelectedPartner(partner)
    setSelectedDate(null)
    setSelectedTimes([])
    if (onlyAvailable) {
      setStep(3)
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
      case 1: return selectedDate !== null
      case 2: return selectedTimes.length > 0
      default: return true
    }
  }, [step, selectedPartner, selectedDate, selectedTimes])

  return (
    <div className="max-w-2xl mx-auto mt-36 rounded-3xl p-0 shadow-2xl bg-[#1e293b]/80 backdrop-blur-lg border border-white/10 overflow-hidden">
      {/* 步驟指示器 */}
      <div className="px-4 sm:px-10 pt-6 sm:pt-10 pb-4 sm:pb-6 bg-[#334155]/20">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-4 sm:left-6 right-4 sm:right-6 h-1 bg-[#475569]/30 -z-10 rounded-full" style={{transform:'translateY(-50%)'}} />
          {steps.map((s, i) => (
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
                        flipped={selectedPartner?.id === p.id}
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
                      className={`px-4 py-2 rounded ${isSelected ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}
                      onClick={() => handleDateSelect(d)}
                    >
                      {label}
                    </button>
                  );
                })}
              {availableDates.length === 0 && (
                <div className="text-gray-400">目前沒有可預約日期</div>
              )}
            </div>
          </div>
        )}
        {!onlyAvailable && step === 2 && selectedPartner && selectedDate && (
          <div>
            <div className="text-lg text-white/90 mb-4">（3）選擇時段</div>
            <div className="flex flex-wrap gap-2">
              {availableTimeSlots.length === 0 ? (
                <div className="text-gray-400">此日無可預約時段</div>
              ) : (
                availableTimeSlots.map(s => (
                  <button
                    key={s.id}
                    className={`px-4 py-2 rounded ${selectedTimes.includes(s.id) ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}
                    onClick={() => handleTimeSelect(s.id)}
                  >
                    {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}~{new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {!onlyAvailable && step === 3 && selectedPartner && selectedDate && selectedTimes.length > 0 && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-white/90 text-xl font-bold mb-4">預約確認</div>
            <div className="flex items-center gap-4 bg-white/10 rounded-2xl p-6 border border-white/10">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-400 overflow-hidden">
                {selectedPartner.coverImage
                  ? <img src={selectedPartner.coverImage} alt={selectedPartner.name} className="object-cover w-full h-full" />
                  : selectedPartner.name[0]}
              </div>
              <div>
                <div className="text-lg font-bold text-white">{selectedPartner.name}</div>
                <div className="text-sm text-indigo-300">{selectedPartner.games.join('、')}</div>
              </div>
            </div>
            <div className="text-white/80">
              預約時段：
              <ul>
                {selectedTimes.map(timeId => {
                  const schedule = selectedPartner.schedules.find(s => s.id === timeId);
                  if (!schedule) return null;
                  // 取得本地日期字串
                  const start = new Date(schedule.startTime);
                  const end = new Date(schedule.endTime);
                  const dateLabel = `${start.getFullYear()}/${(start.getMonth()+1).toString().padStart(2,'0')}/${start.getDate().toString().padStart(2,'0')}`;
                  const startLabel = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                  const endLabel = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                  return <li key={timeId}>{dateLabel} {startLabel} - {endLabel}</li>
                })}
              </ul>
            </div>
            <div className="text-white/90 text-lg font-bold">
              總金額：${selectedTimes.length * selectedPartner.halfHourlyRate}
            </div>
            <button
              className={`px-8 py-3 rounded-full text-white font-bold text-lg shadow-xl transition ${
                isProcessing 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : 'bg-[#10b981] hover:bg-[#059669] active:scale-95'
              }`}
              onClick={handleCreateBooking}
              disabled={isProcessing}
            >
              {isProcessing ? '處理中...' : '確認預約並付款'}
            </button>
          </div>
        )}
        {step === 4 && (
          <div className="flex flex-col items-center text-center min-h-[200px] justify-center">
            <div className="w-20 h-20 flex items-center justify-center rounded-full bg-[#f59e0b] mb-6">
              <span className="text-4xl text-white">💳</span>
            </div>
            <div className="text-2xl font-bold text-white mb-2">正在跳轉到付款頁面</div>
            <div className="text-gray-300 mb-4">請稍候，正在為您準備安全的付款環境...</div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto"></div>
          </div>
        )}
        {step === 5 && (
          <div className="flex flex-col items-center text-center min-h-[200px] justify-center">
            <div className="w-20 h-20 flex items-center justify-center rounded-full bg-[#10b981] mb-6">
              <span className="text-4xl text-white">✅</span>
            </div>
            <div className="text-2xl font-bold text-white mb-2">預約完成！</div>
            <div className="text-gray-300 mb-4">您的預約已成功建立，付款完成後即可開始遊戲。</div>
            <div className="text-sm text-gray-400 mb-6">
              <p>• 付款成功後，夥伴會收到通知</p>
              <p>• 請在預約時間準時上線</p>
              <p>• 如有問題請聯繫客服</p>
            </div>
            <button className="mt-4 px-6 py-2 rounded-full bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition-colors" onClick={() => setStep(0)}>
              返回首頁
            </button>
          </div>
        )}
      </div>

      {/* 導航按鈕 */}
      {step < 6 && (
        <div className={`flex items-center px-4 sm:px-10 pb-8 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
          {step > 0 && (
            <button
              className="px-4 sm:px-6 py-2 rounded-full bg-gray-700/60 text-white/80 font-bold hover:bg-gray-600 active:scale-95 transition text-sm sm:text-base"
              onClick={handlePrevStep}
            >
              上一步
            </button>
          )}

          {step < 3 && (
            <button
              className="px-4 sm:px-6 py-2 rounded-full bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition disabled:opacity-40 text-sm sm:text-base"
              onClick={handleNextStep}
              disabled={!canProceed}
            >
              下一步
            </button>
          )}
        </div>
      )}
      <style jsx global>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px);} to { opacity: 1; transform: none; } }
        .animate-fadein { animation: fadein 0.5s; }
      `}</style>
    </div>
  )
}

export default function BookingWizard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    }>
      <BookingWizardContent />
    </Suspense>
  );
} 