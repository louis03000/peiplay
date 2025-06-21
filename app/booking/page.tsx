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
  schedules: { id: string; date: string; startTime: string; endTime: string }[];
};

export default function BookingWizard() {
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [instantBooking, setInstantBooking] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

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
            <div className="flex justify-end mt-8">
              <button
                className="px-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition disabled:opacity-40"
                onClick={() => setStep(2)}
                disabled={!selectedDate}
              >
                下一步
              </button>
            </div>
          </div>
        )}
        {step === 2 && selectedPartner && selectedDate && (
          <div>
            <div className="text-lg text-white/90 mb-4">（3）選擇時段</div>
            <div className="flex flex-wrap gap-2">
              {selectedPartner.schedules
                .filter(s => {
                  const d = new Date(s.date);
                  d.setHours(0,0,0,0);
                  return d.getTime() === selectedDate.getTime();
                })
                .map(s => (
                  <button
                    key={s.id}
                    className={`px-4 py-2 rounded ${selectedTime === s.id ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}
                    onClick={() => setSelectedTime(s.id)}
                  >
                    {s.startTime.slice(11, 16)}~{s.endTime.slice(11, 16)}
                  </button>
                ))}
              {selectedPartner.schedules.filter(s => {
                const d = new Date(s.date);
                d.setHours(0,0,0,0);
                return d.getTime() === selectedDate.getTime();
              }).length === 0 && (
                <div className="text-gray-400">此日無可預約時段</div>
              )}
            </div>
            <button
              className="fixed bottom-8 right-8 z-50 px-8 py-3 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-lg font-bold shadow-2xl hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition disabled:opacity-40"
              onClick={() => setStep(3)}
              disabled={!selectedTime}
            >
              下一步
            </button>
          </div>
        )}
        {step === 3 && selectedPartner && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-white/90 text-xl font-bold mb-4">預約確認</div>
            <div className="flex items-center gap-4 bg-white/10 rounded-2xl p-6 border border-white/10">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-400 mr-4">
                {selectedPartner.name[0]}
              </div>
              <div>
                <div className="font-bold text-white text-lg mb-1">{selectedPartner.name}</div>
                <div className="text-xs text-indigo-300 mb-1">{selectedPartner.games?.join('、')}</div>
                <div className="text-sm text-gray-300">每小時 {selectedPartner.hourlyRate} 元</div>
              </div>
            </div>
            <button
              className="mt-6 px-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition"
              onClick={() => setStep(4)}
            >
              確認送出預約
            </button>
          </div>
        )}
        {step === 4 && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-green-400 text-3xl">✔</div>
            <div className="text-green-300 text-xl font-bold">預約成功！</div>
            <button
              className="mt-4 px-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition"
              onClick={() => { setStep(0); setInstantBooking(false); setSelectedPartner(null) }}
            >
              回到預約首頁
            </button>
          </div>
        )}
                    </div>

      {/* 上一步/下一步按鈕 */}
      <div className="flex justify-between px-10 pb-10">
        <button
          className="px-6 py-2 rounded-full bg-gray-800/80 text-white font-medium shadow hover:bg-gray-700/90 transition disabled:opacity-40"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          上一步
        </button>
        {/* 其他步驟維持原本邏輯 */}
        {step !== 1 && step !== 2 && step < 3 && (
          <button
            className="px-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition disabled:opacity-40"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={
              step === steps.length - 1 ||
              (step === 0 && !selectedPartner)
            }
          >
            下一步
          </button>
        )}
      </div>
      <style jsx global>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px);} to { opacity: 1; transform: none; } }
        .animate-fadein { animation: fadein 0.5s; }
      `}</style>
    </div>
  )
} 