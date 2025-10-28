'use client'

import { useState, useEffect } from 'react'

interface Announcement {
  id: string
  title: string
  content: string
  type: 'SYSTEM_NOTICE' | 'ACTIVITY_NOTICE' | 'SYSTEM_ANNOUNCEMENT'
  createdAt: string
  expiresAt?: string
  creator: {
    name: string
  }
}

const ANNOUNCEMENT_TYPES = [
  { value: 'SYSTEM_NOTICE', label: '系統通知', icon: '🔔', color: 'text-blue-400' },
  { value: 'ACTIVITY_NOTICE', label: '活動公告', icon: '🎉', color: 'text-green-400' },
  { value: 'SYSTEM_ANNOUNCEMENT', label: '系統公告', icon: '📢', color: 'text-purple-400' }
]

export default function AnnouncementPanel() {
  console.log('🚀 AnnouncementPanel 組件已載入')
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      console.log('🔄 開始載入公告...')
      
      const response = await fetch('/api/announcements')
      console.log('📡 API 回應狀態:', response.status)
      
      if (!response.ok) {
        console.log('❌ API 回應失敗:', response.status)
        throw new Error('無法載入公告')
      }
      
      const data = await response.json()
      console.log('📊 收到的公告數據:', data)
      
      setAnnouncements(data.announcements || [])
      
      // 檢查是否有新公告（今天發布的）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const hasNew = (data.announcements || []).some((ann: Announcement) => 
        new Date(ann.createdAt) >= today
      )
      setHasNewAnnouncements(hasNew)
      
      console.log('✅ 公告載入完成，數量:', data.announcements?.length || 0)
      
    } catch (err) {
      console.error('❌ 載入公告失敗:', err)
      setError(err instanceof Error ? err.message : '載入失敗')
      setAnnouncements([]) // 確保有預設值
    } finally {
      setLoading(false)
    }
  }

  const getTypeInfo = (type: string) => {
    return ANNOUNCEMENT_TYPES.find(t => t.value === type) || ANNOUNCEMENT_TYPES[0]
  }

  if (loading) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
        >
          <span className="text-lg">📢</span>
          <span className="text-sm font-medium">公告</span>
          {hasNewAnnouncements && (
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          )}
        </button>
      </div>
    )
  }

  if (error || announcements.length === 0) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
        >
          <span className="text-lg">📢</span>
          <span className="text-sm font-medium">公告</span>
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          console.log('🖱️ 公告按鈕被點擊，當前狀態:', isOpen)
          setIsOpen(!isOpen)
        }}
        className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
      >
        <span className="text-lg">📢</span>
        <span className="text-sm font-medium">公告</span>
        {hasNewAnnouncements && (
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <>
          {console.log('📋 顯示公告面板，公告數量:', announcements.length)}
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => {
              console.log('🖱️ 背景被點擊，關閉面板')
              setIsOpen(false)
            }}
          />
          
          {/* 公告面板 */}
          <div className="absolute top-full right-0 mt-2 w-96 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">📢 最新公告</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {announcements.map((announcement) => {
                const typeInfo = getTypeInfo(announcement.type)
                return (
                  <div key={announcement.id} className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-lg">{typeInfo.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white text-sm">{announcement.title}</h4>
                          <span className={`text-xs ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">
                          {new Date(announcement.createdAt).toLocaleString('zh-TW')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-600/50 rounded p-3">
                      <p className="text-gray-300 text-sm whitespace-pre-wrap line-clamp-3">
                        {announcement.content}
                      </p>
                    </div>
                    
                    {announcement.expiresAt && (
                      <p className="text-xs text-yellow-400 mt-2">
                        ⏰ 過期時間：{new Date(announcement.expiresAt).toLocaleString('zh-TW')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false)
                  // 這裡可以導航到完整的公告頁面
                }}
                className="w-full text-center text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                查看所有公告 →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
