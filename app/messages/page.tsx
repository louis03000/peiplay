'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  subject: string;
  content: string;
  type: 'PRIVATE' | 'SYSTEM' | 'BOOKING' | 'ADMIN';
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState({ messages: 0, notifications: 0 });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 獲取訊息
      const messagesResponse = await fetch('/api/messages');
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        setMessages(messagesData.messages);
        setUnreadCount(prev => ({ ...prev, messages: messagesData.unreadCount }));
      }

      // 獲取通知
      const notificationsResponse = await fetch('/api/notifications');
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        setNotifications(notificationsData.notifications);
        setUnreadCount(prev => ({ ...prev, notifications: notificationsData.unreadCount }));
      }
    } catch (error) {
      console.error('獲取資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string, type: 'message' | 'notification') => {
    try {
      if (type === 'message') {
        await fetch(`/api/messages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        });
      } else {
        await fetch(`/api/notifications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        });
      }
      
      fetchData(); // 重新獲取資料
    } catch (error) {
      console.error('標記已讀失敗:', error);
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'SYSTEM': return 'bg-blue-100 text-blue-800';
      case 'BOOKING': return 'bg-green-100 text-green-800';
      case 'ADMIN': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMessageTypeText = (type: string) => {
    switch (type) {
      case 'PRIVATE': return '私信';
      case 'SYSTEM': return '系統通知';
      case 'BOOKING': return '預約相關';
      case 'ADMIN': return '管理員廣播';
      default: return '未知';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">信箱</h1>
          <p className="mt-2 text-gray-600">查看您的訊息和通知</p>
        </div>

        {/* 標籤頁 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('messages')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'messages'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                訊息
                {unreadCount.messages > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {unreadCount.messages}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'notifications'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                通知
                {unreadCount.notifications > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {unreadCount.notifications}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* 內容區域 */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'messages' ? (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">訊息列表</h2>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📧</div>
                  <p className="text-gray-500">暫無訊息</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        message.isRead
                          ? 'bg-white border-gray-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                      onClick={() => markAsRead(message.id, 'message')}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className={`font-medium ${message.isRead ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
                              {message.subject}
                            </h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${getMessageTypeColor(message.type)}`}>
                              {getMessageTypeText(message.type)}
                            </span>
                            {!message.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                            {message.content}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <span>來自: {message.sender.name}</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(message.createdAt).toLocaleString('zh-TW')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">通知列表</h2>
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🔔</div>
                  <p className="text-gray-500">暫無通知</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        notification.isRead
                          ? 'bg-white border-gray-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                      onClick={() => markAsRead(notification.id, 'notification')}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className={`font-medium ${notification.isRead ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2">
                            {notification.content}
                          </p>
                          <div className="text-xs text-gray-500">
                            {new Date(notification.createdAt).toLocaleString('zh-TW')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
