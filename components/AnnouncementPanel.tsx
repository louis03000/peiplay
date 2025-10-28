'use client'

import { useState } from 'react'

export default function AnnouncementPanel() {
  console.log('🚀 AnnouncementPanel 組件已載入')
  
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = () => {
    console.log('🖱️ 公告按鈕被點擊！')
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
      >
        <span className="text-lg">📢</span>
        <span className="text-sm font-medium">公告</span>
      </button>

      {/* 簡單的測試面板 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 p-4">
          <h3 className="text-white font-semibold mb-2">📢 公告測試</h3>
          <p className="text-gray-300 text-sm">這是一個測試面板</p>
          <button
            onClick={() => setIsOpen(false)}
            className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  )
}