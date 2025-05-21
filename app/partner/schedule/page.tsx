'use client'
import { useState } from 'react'
export const dynamic = 'force-dynamic'

export default function PartnerSchedulePage() {
  // 假設預設為沒空
  const [isAvailableNow, setIsAvailableNow] = useState(false)

  return (
    <div className="max-w-2xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">夥伴時段管理</h2>
      <div className="flex items-center justify-center mb-8">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className={`w-3 h-3 rounded-full ${isAvailableNow ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
          <span className="text-white text-lg font-medium">現在有空</span>
          <input
            type="checkbox"
            checked={isAvailableNow}
            onChange={e => setIsAvailableNow(e.target.checked)}
            className="accent-green-500 w-6 h-6"
          />
        </label>
        <span className={`ml-4 text-sm font-bold ${isAvailableNow ? 'text-green-400' : 'text-gray-400'}`}>{isAvailableNow ? '顧客可即時預約你' : '顧客看不到你'}</span>
      </div>
      <p className="text-gray-300 text-center">這裡是夥伴管理自己可預約時段的頁面。</p>
    </div>
  )
} 