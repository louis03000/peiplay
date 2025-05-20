'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'

const steps = [
  '選擇夥伴',
  '選擇日期',
  '選擇時段',
  '填寫資料',
  '確認預約',
  '完成'
]

// 假資料
const partners = [
  {
    id: 'p1',
    name: '小明',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    skills: ['Switch', '瑪利歐賽車', '健身環'],
    desc: '熱情活潑，擅長 Switch 各類遊戲，歡迎一起玩！',
    isAvailableNow: true,
  },
  {
    id: 'p2',
    name: '小美',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    skills: ['PS5', 'FIFA', 'NBA 2K'],
    desc: '運動遊戲高手，PS5 也能陪玩！',
    isAvailableNow: false,
  },
  {
    id: 'p3',
    name: '阿宅',
    avatar: 'https://randomuser.me/api/portraits/men/65.jpg',
    skills: ['Steam', 'LOL', 'APEX'],
    desc: '電競宅，歡迎一起開黑！',
    isAvailableNow: true,
  },
]

export default function BookingWizard() {
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedPartner, setSelectedPartner] = useState(null as null | typeof partners[0])
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [instantBooking, setInstantBooking] = useState(false)

  // 搜尋過濾
  const filteredPartners = partners.filter(p =>
    (p.name.includes(search) || p.skills.some(s => s.includes(search))) &&
    (!onlyAvailable || p.isAvailableNow)
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
                  <img src={p.avatar} alt={p.name} className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
                  <div className="flex-1">
                    <div className="font-bold text-white text-lg flex items-center gap-2">
                      {p.name}
                      {p.isAvailableNow && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>現在有空</span>}
                    </div>
                    <div className="text-xs text-indigo-300 mb-1">{p.skills.join('、')}</div>
                    <div className="text-sm text-gray-300">{p.desc}</div>
                  </div>
                  {p.isAvailableNow && (
                      <button
                      className="ml-2 px-3 py-1 rounded-full bg-green-500/90 text-white text-xs font-bold shadow hover:bg-green-600 transition"
                      onClick={e => { e.stopPropagation(); handleInstantBook(p) }}
                      >
                      馬上預約
                      </button>
                  )}
                  {selectedPartner?.id === p.id && <div className="text-indigo-400 font-bold">✔</div>}
                    </div>
              ))}
                      </div>
                    </div>
        )}
        {step === 1 && <div className="text-lg text-white/90">（2）選擇日期（月曆元件）</div>}
        {step === 2 && <div className="text-lg text-white/90">（3）選擇時段（時段表）</div>}
        {step === 3 && <div className="text-lg text-white/90">（4）填寫/確認個人資料</div>}
        {step === 4 && <div className="text-lg text-white/90">（5）預約資訊確認與送出</div>}
        {step === 5 && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-green-400 text-3xl">✔</div>
            <div className="text-green-300 text-xl font-bold">預約成功！</div>
            {instantBooking && selectedPartner ? (
              <div className="text-white/90 text-center">
                你已成功預約 <span className="font-bold text-indigo-300">{selectedPartner.name}</span> 進行即時陪玩！<br />
                <span className="text-sm text-gray-300">時間：現在（即時）</span>
                      </div>
            ) : (
              <div className="text-white/90">（6）預約成功！</div>
            )}
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
                      <button
          className="px-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold shadow-lg hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition disabled:opacity-40"
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={step === steps.length - 1 || (step === 0 && !selectedPartner)}
                      >
          下一步
                      </button>
      </div>
      <style jsx global>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(20px);} to { opacity: 1; transform: none; } }
        .animate-fadein { animation: fadein 0.5s; }
      `}</style>
    </div>
  )
} 