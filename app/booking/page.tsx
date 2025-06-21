'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const steps = [
  '選擇夥伴',
  '選擇日期',
  '選擇時段',
  '確認預約',
  '完成'
]

export type Partner = {
  id: string;
  name: string;
  games: string[];
  hourlyRate: number;
  coverImage?: string;
  schedules: { id: string; date: string; startTime: string; endTime: string, isAvailable: boolean }[];
};

export default function BookingWizard() {
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [instantBooking, setInstantBooking] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/partners')
      .then(res => res.json())
      .then(data => setPartners(data))
  }, [])

  // 搜尋過濾
  const filteredPartners = partners.filter(p =>
    (p.name.includes(search) || (p.games && p.games.some(s => s.includes(search))))
    // 這裡如需只看現在有空可再加條件
  )

  // 處理馬上預約
  const handleInstantBook = (p: typeof partners[0]) => {
    setSelectedPartner(p)
    setInstantBooking(true)
    setStep(5) // 直接跳到預約成功畫面
  }

  const handleTimeSelect = (timeId: string) => {
    setSelectedTimes(prev => 
      prev.includes(timeId) 
        ? prev.filter(t => t !== timeId)
        : [...prev, timeId]
    )
  }

  const handleCreateBooking = async () => {
    if (!selectedPartner || selectedTimes.length === 0) return;

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerId: selectedPartner.id,
        scheduleIds: selectedTimes,
      }),
    });

    if (res.ok) {
      setStep(4); // Go to success step
    } else {
      alert('預約失敗，請重試');
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 rounded-3xl p-0 shadow-2xl bg-gradient-to-br from-[#23243a]/80 via-[#2d2e4a]/70 to-[#1a1b2b]/80 backdrop-blur-lg border border-white/10 overflow-hidden">
      {/* 步驟指示器 */}
      <div className="px-10 pt-10 pb-6 bg-gradient-to-r from-indigo-500/20 to-purple-500/10">
        <div className="flex items-center justify-between relative">
          {/* 進度條 */}
          <div className="absolute top-1/2 left-6 right-6 h-1 bg-gradient-to-r from-indigo-400/30 to-purple-400/30 -z-10 rounded-full" style={{transform:'translateY(-50%)'}} />
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 transition-all duration-300
                ${i < step ? 'bg-gradient-to-br from-indigo-400 to-purple-400 border-purple-400 text-white shadow-lg' :
                  i === step ? 'bg-gradient-to-br from-indigo-500 to-purple-500 border-indigo-400 text-white shadow-xl scale-110' :
                  'bg-gray-800 border-gray-600 text-gray-400'}`}>{i+1}</div>
              <div className={`mt-2 text-xs ${i === step ? 'text-indigo-300 font-bold' : 'text-gray-400'}`}>{s}</div>
            </div>
          ))}
                      </div>
                    </div>

      {/* 步驟內容 */}
      <div className="min-h-[200px] flex flex-col items-center justify-center px-10 py-12 transition-all duration-300 animate-fadein">
        {step === 0 && (
          <div className="w-full">
            <div className="flex items-center gap-4 mb-6">
                        <input
                className="flex-1 px-4 py-2 rounded-full bg-gray-900/80 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-gray-400"
                placeholder="搜尋夥伴姓名或專長..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-indigo-300 cursor-pointer select-none">
                        <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={e => setOnlyAvailable(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4"
                        />
                只看現在有空
              </label>
                      </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPartners.length === 0 && <div className="col-span-2 text-gray-400 text-center">查無夥伴</div>}
              {filteredPartners.map(p => (
                <div
                  key={p.id}
                  className={`rounded-2xl bg-white/10 border border-white/10 shadow-lg p-4 flex gap-4 items-center cursor-pointer transition-all duration-200 hover:scale-105 hover:border-indigo-400 ${selectedPartner?.id === p.id ? 'ring-2 ring-indigo-400' : ''}`}
                  onClick={() => setSelectedPartner(p)}
                >
                  {/* 封面照：有圖顯圖，沒圖顯首字 */}
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-400 mr-2 overflow-hidden">
                    {p.coverImage
                      ? <img src={p.coverImage} alt={p.name} className="object-cover w-full h-full" />
                      : p.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-lg flex items-center gap-2">
                      {p.name}
                    </div>
                    <div className="text-xs text-indigo-300 mb-1">{p.games?.join('、')}</div>
                    <div className="text-sm text-gray-300">每小時 {p.hourlyRate} 元</div>
                  </div>
                  {selectedPartner?.id === p.id && <div className="text-indigo-400 font-bold">✔</div>}
                </div>
              ))}
                      </div>
                    </div>
        )}
        {step === 1 && selectedPartner && (
          <div>
            <div className="text-lg text-white/90 mb-4">（2）選擇日期</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {Array.from(new Set(selectedPartner.schedules.map(s => {
                const d = new Date(s.date);
                d.setHours(0,0,0,0);
                return d.getTime();
              })))
                .sort((a, b) => a - b)
                .map(ts => {
                  const d = new Date(ts);
                  const label = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
                  const isSelected = selectedDate && d.getTime() === selectedDate.getTime();
                  return (
                    <button
                      key={ts}
                      className={`px-4 py-2 rounded ${isSelected ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      {label}
                    </button>
                  );
                })}
              {selectedPartner.schedules.length === 0 && (
                <div className="text-gray-400">目前沒有可預約日期</div>
              )}
            </div>
          </div>
        )}
        {step === 2 && selectedPartner && selectedDate && (
          <div>
            <div className="text-lg text-white/90 mb-4">（3）選擇時段</div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const seenTimeSlots = new Set();
                const uniqueSchedules = selectedPartner.schedules.filter(schedule => {
                  const scheduleDate = new Date(schedule.date);
                  scheduleDate.setHours(0, 0, 0, 0);
                  
                  if (scheduleDate.getTime() !== selectedDate.getTime()) {
                    return false;
                  }
                  
                  const timeSlotIdentifier = `${schedule.startTime}-${schedule.endTime}`;
                  if (seenTimeSlots.has(timeSlotIdentifier)) {
                    return false;
                  }
                  
                  seenTimeSlots.add(timeSlotIdentifier);
                  return true;
                });

                if (uniqueSchedules.length === 0) {
                  return <div className="text-gray-400">此日無可預約時段</div>;
                }

                return uniqueSchedules.map(s => (
                  <button
                    key={s.id}
                    className={`px-4 py-2 rounded ${selectedTimes.includes(s.id) ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}
                    onClick={() => handleTimeSelect(s.id)}
                  >
                    {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}~{new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </button>
                ));
              })()}
            </div>
          </div>
        )}
        {step === 3 && selectedPartner && selectedDate && selectedTimes.length > 0 && (
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
                  return <li key={timeId}>{selectedDate?.toLocaleDateString()} {schedule?.startTime.slice(11,16)} - {schedule?.endTime.slice(11,16)}</li>
                })}
              </ul>
            </div>
            <button
              className="px-8 py-3 rounded-full bg-gradient-to-r from-green-400 to-cyan-500 text-white font-bold text-lg shadow-xl hover:from-green-500 hover:to-cyan-600 active:scale-95 transition"
              onClick={handleCreateBooking}
            >
              確認預約
            </button>
          </div>
        )}
        {step === 4 && (
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-cyan-500 mb-6">
              <span className="text-4xl text-white">✔</span>
            </div>
            <div className="text-2xl font-bold text-white">預約成功！</div>
            <div className="text-gray-300 mt-2">已為您保留時段，請準時上線。</div>
            <button className="mt-8 px-6 py-2 rounded-full bg-indigo-500 text-white font-bold" onClick={() => {
              setStep(0);
              setSelectedPartner(null);
              setSelectedDate(null);
              setSelectedTimes([]);
            }}>返回首頁</button>
          </div>
        )}
      </div>

      {/* 導航按鈕 */}
      {step < 4 && (
        <div className={`flex items-center px-10 pb-8 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
          {step > 0 && (
            <button
              className="px-6 py-2 rounded-full bg-gray-700/60 text-white/80 font-bold hover:bg-gray-600 active:scale-95 transition"
              onClick={() => setStep(step - 1)}
            >
              上一步
            </button>
          )}

          {step < 3 && (
            <button
              className="px-6 py-2 rounded-full bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition disabled:opacity-40"
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 0 && !selectedPartner) ||
                (step === 1 && !selectedDate) ||
                (step === 2 && selectedTimes.length === 0)
              }
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