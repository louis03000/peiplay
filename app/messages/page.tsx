'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Message {
  id: string
  content: string
  isRead: boolean
  createdAt: string
  sender: {
    id: string
    name: string
    email: string
    role: string
  }
  receiver: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface Notification {
  id: string
  title: string
  content: string
  type: string
  isRead: boolean
  createdAt: string
  data?: any
}

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const user = session?.user
  const isAuthenticated = status === 'authenticated'
  const authLoading = status === 'loading'
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages')
  const [messages, setMessages] = useState<Message[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unreadCounts, setUnreadCounts] = useState({
    messages: 0,
    notifications: 0
  })

  // 新訊息表單
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [newMessage, setNewMessage] = useState({
    receiverId: '',
    content: ''
  })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      window.location.href = '/auth/login'
      return
    }
    loadData()
  }, [isAuthenticated, authLoading])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 載入訊息和通知
      const [messagesRes, notificationsRes] = await Promise.all([
        fetch('/api/messages?type=all&limit=50'),
        fetch('/api/notifications?limit=50')
      ])

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json()
        setMessages(messagesData.messages || [])
        setUnreadCounts(prev => ({ ...prev, messages: messagesData.unreadCount || 0 }))
      }

      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json()
        setNotifications(notificationsData.notifications || [])
        setUnreadCounts(prev => ({ ...prev, notifications: notificationsData.unreadCount || 0 }))
      }
    } catch (error) {
      console.error('載入資料失敗:', error)
      setError('載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.receiverId || !newMessage.content.trim()) {
      setError('請填寫完整資訊')
      return
    }

    try {
      setSending(true)
      
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage)
      })

      if (response.ok) {
        setNewMessage({ receiverId: '', content: '' })
        setShowNewMessage(false)
        loadData() // 重新載入資料
      } else {
        const errorData = await response.json()
        setError(errorData.error || '發送訊息失敗')
      }
    } catch (error) {
      console.error('發送訊息失敗:', error)
      setError('發送訊息失敗')
    } finally {
      setSending(false)
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH'
      })
      loadData() // 重新載入資料
    } catch (error) {
      console.error('標記已讀失敗:', error)
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      loadData() // 重新載入資料
    } catch (error) {
      console.error('標記通知已讀失敗:', error)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError('')
              loadData()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重試
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📧 信箱</h1>
          <p className="text-gray-600">查看您的訊息和通知</p>
        </div>

        {/* 標籤頁 */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('messages')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'messages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                訊息
                {unreadCounts.messages > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {unreadCounts.messages}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'notifications'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                通知
                {unreadCounts.notifications > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {unreadCounts.notifications}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'messages' && (
              <div>
                {/* 新訊息按鈕 */}
                <div className="mb-6">
                  <button
                    onClick={() => setShowNewMessage(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ✍️ 撰寫新訊息
                  </button>
                </div>

                {/* 新訊息表單 */}
                {showNewMessage && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold mb-4">撰寫新訊息</h3>
                    <form onSubmit={handleSendMessage} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          接收者 Email
                        </label>
                        <input
                          type="email"
                          value={newMessage.receiverId}
                          onChange={(e) => setNewMessage({...newMessage, receiverId: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="輸入接收者的 Email"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          訊息內容
                        </label>
                        <textarea
                          value={newMessage.content}
                          onChange={(e) => setNewMessage({...newMessage, content: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={4}
                          placeholder="輸入訊息內容..."
                          required
                        />
                      </div>
                      <div className="flex space-x-4">
                        <button
                          type="submit"
                          disabled={sending}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {sending ? '發送中...' : '發送'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewMessage(false)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                          取消
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* 訊息列表 */}
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      沒有訊息
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          message.isRead ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                        }`}
                        onClick={() => !message.isRead && markAsRead(message.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {message.sender.id === user?.id ? '我' : message.sender.name || message.sender.email}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="font-medium">
                              {message.receiver.id === user?.id ? '我' : message.receiver.name || message.receiver.email}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {!message.isRead && (
                              <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                                未讀
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {new Date(message.createdAt).toLocaleString('zh-TW')}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-700">{message.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                {/* 標記全部已讀按鈕 */}
                {unreadCounts.notifications > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={markAllNotificationsRead}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      ✓ 標記全部已讀
                    </button>
                  </div>
                )}

                {/* 通知列表 */}
                <div className="space-y-4">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      沒有通知
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`border rounded-lg p-4 ${
                          notification.isRead ? 'bg-white border-gray-200' : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                          <div className="flex items-center space-x-2">
                            {!notification.isRead && (
                              <span className="bg-yellow-500 text-white text-xs rounded-full px-2 py-1">
                                未讀
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {new Date(notification.createdAt).toLocaleString('zh-TW')}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-700">{notification.content}</p>
                        <div className="mt-2">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {notification.type}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
