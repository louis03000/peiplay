'use client'

import { useState } from 'react'

export default function PartnerFilter({ onFilter }: { onFilter: (start: string, end: string, game?: string, startTime?: string, endTime?: string) => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [gameSearch, setGameSearch] = useState('')

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <form
        className="flex flex-col gap-4 items-center justify-center mb-4"
        onSubmit={e => {
          e.preventDefault()
          onFilter(startDate, endDate, gameSearch, startTime, endTime)
        }}
      >
        {/* 日期範圍 */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
            placeholder="年/月/日"
          />
          <span className="text-gray-500">至</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
            placeholder="年/月/日"
          />
        </div>
        
        {/* 時段範圍 */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
            placeholder="開始時間"
          />
          <span className="text-gray-500">至</span>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
            placeholder="結束時間"
          />
        </div>
        
        <button
          type="submit"
          className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow hover:scale-105 transition-transform"
        >
          篩選
        </button>
      </form>
      
      {/* 遊戲搜尋 */}
      <form
        className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        onSubmit={e => {
          e.preventDefault()
          onFilter(startDate, endDate, gameSearch, startTime, endTime)
        }}
      >
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={gameSearch}
            onChange={e => setGameSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
            placeholder="搜尋遊戲 (例如: LOL, 英雄聯盟, APEX...)"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow hover:scale-105 transition-transform"
        >
          搜尋遊戲
        </button>
      </form>
    </div>
  )
} 