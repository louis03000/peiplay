'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

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
  { value: 'SYSTEM_NOTICE', label: '系統通知' },
  { value: 'ACTIVITY_NOTICE', label: '活動公告' },
  { value: 'SYSTEM_ANNOUNCEMENT', label: '系統公告' }
]

export default function AnnouncementManagementPage() {
  const { data: session, status } = useSession()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 表單狀態
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'SYSTEM_NOTICE' as const,
    expiresAt: ''
  })

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchAnnouncements()
    }
  }, [status, session])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/announcements')
      
      if (!response.ok) {
        throw new Error('無法載入公告')
      }
      
      const data = await response.json()
      setAnnouncements(data.announcements)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.content) {
      setError('請填寫標題和內容')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          type: formData.type,
          expiresAt: formData.expiresAt || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '發布失敗')
      }

      // 重置表單
      setFormData({
        title: '',
        content: '',
        type: 'SYSTEM_NOTICE',
        expiresAt: ''
      })
      setShowCreateForm(false)
      
      // 重新載入公告
      await fetchAnnouncements()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '發布失敗')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">載入中...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-white text-2xl font-bold mb-2">無權限訪問</h1>
          <p className="text-gray-300">僅管理員可訪問此頁面</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 頁面標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">📢 公告管理</h1>
          <p className="text-gray-300">管理系統公告、活動公告和系統通知</p>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* 創建公告按鈕 */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {showCreateForm ? '取消' : '+ 發布新公告'}
          </button>
        </div>

        {/* 創建公告表單 */}
        {showCreateForm && (
          <div className="mb-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">發布新公告</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  標題
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輸入公告標題"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  類型
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ANNOUNCEMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  內容
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輸入公告內容"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  過期時間（可選）
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">留空表示永不過期</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {submitting ? '發布中...' : '發布公告'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 公告列表 */}
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-6xl mb-4">📢</div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">暫無公告</h3>
              <p className="text-gray-400">還沒有發布任何公告</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div key={announcement.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{announcement.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        announcement.type === 'SYSTEM_NOTICE' ? 'bg-blue-500/20 text-blue-300' :
                        announcement.type === 'ACTIVITY_NOTICE' ? 'bg-green-500/20 text-green-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {ANNOUNCEMENT_TYPES.find(t => t.value === announcement.type)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>發布者：{announcement.creator.name}</span>
                      <span>發布時間：{new Date(announcement.createdAt).toLocaleString('zh-TW')}</span>
                      {announcement.expiresAt && (
                        <span>過期時間：{new Date(announcement.expiresAt).toLocaleString('zh-TW')}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-300 whitespace-pre-wrap">{announcement.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
