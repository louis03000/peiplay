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
      {/* 功能說明 */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-900">🔍 如何使用搜尋功能</h3>
            <div className="mt-2 text-sm text-purple-800">
              <p className="mb-2"><strong>選定特定日期和時段：</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>選擇您想要預約的日期範圍（例如：本週六到下週日）</li>
                <li>選擇您想要的時段（例如：晚上 8 點到 10 點）</li>
                <li>系統會自動篩選出在這個時段有空的夥伴</li>
                <li>您可以額外輸入遊戲名稱來進一步篩選</li>
              </ul>
              <p className="mt-2 text-xs text-purple-600">💡 小提示：如果不選擇時段，將顯示所有有空的夥伴</p>
            </div>
          </div>
        </div>
      </div>

      <form
        className="flex flex-col gap-4 items-center justify-center mb-4"
        onSubmit={e => {
          e.preventDefault()
          onFilter(startDate, endDate, gameSearch, startTime, endTime)
        }}
      >
        {/* 日期範圍 */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📅 選擇日期範圍（必填）
          </label>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
              placeholder="開始日期"
              required
            />
            <span className="text-gray-500">至</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
              placeholder="結束日期"
              required
            />
          </div>
        </div>
        
        {/* 時段範圍 */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ⏰ 選擇時段範圍（選填，不填則顯示全部時段）
          </label>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
              placeholder="開始時間（例如：20:00）"
            />
            <span className="text-gray-500">至</span>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
              placeholder="結束時間（例如：22:00）"
            />
          </div>
        </div>
        
        <button
          type="submit"
          className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow hover:scale-105 transition-transform"
        >
          篩選
        </button>
      </form>
      
      {/* 遊戲搜尋 */}
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          🎮 搜尋遊戲（選填）
        </label>
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
    </div>
  )
} 