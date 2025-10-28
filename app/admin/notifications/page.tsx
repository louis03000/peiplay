'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FaBell, FaEnvelope, FaUser, FaExclamationTriangle, FaInfoCircle, FaClock, FaCheckCircle } from 'react-icons/fa';

interface PersonalNotification {
  id: string;
  title: string;
  content: string;
  type: 'WARNING' | 'VIOLATION' | 'REMINDER' | 'INFO' | 'SYSTEM';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isImportant: boolean;
  isRead: boolean;
  expiresAt?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  sender: {
    id: string;
    name: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminNotificationManagement() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notifications' | 'send'>('notifications');
  
  // 發送通知表單
  const [formData, setFormData] = useState({
    userId: '',
    title: '',
    content: '',
    type: 'INFO' as const,
    priority: 'MEDIUM' as const,
    isImportant: false,
    expiresAt: '',
    sendEmail: false
  });

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchNotifications();
      fetchUsers();
    }
  }, [session]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/personal-notifications');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('獲取通知失敗:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('獲取用戶失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.userId || !formData.title || !formData.content) {
      alert('請填寫所有必要欄位');
      return;
    }

    try {
      const res = await fetch('/api/admin/personal-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      
      if (res.ok) {
        alert('通知發送成功！');
        setFormData({
          userId: '',
          title: '',
          content: '',
          type: 'INFO',
          priority: 'MEDIUM',
          isImportant: false,
          expiresAt: '',
          sendEmail: false
        });
        fetchNotifications();
      } else {
        alert(`發送失敗: ${data.error}`);
      }
    } catch (error) {
      console.error('發送通知失敗:', error);
      alert('發送失敗，請重試');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'WARNING': return <FaExclamationTriangle className="text-yellow-500" />;
      case 'VIOLATION': return <FaExclamationTriangle className="text-red-500" />;
      case 'REMINDER': return <FaClock className="text-blue-500" />;
      case 'SYSTEM': return <FaInfoCircle className="text-gray-500" />;
      default: return <FaInfoCircle className="text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!session?.user || session.user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 text-white">
        <div className="text-center p-8 bg-red-800/50 rounded-lg shadow-lg">
          <p className="text-xl font-bold mb-4">權限不足</p>
          <p>只有管理員可以訪問此頁面</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-2">
            通知管理系統
          </h1>
          <p className="text-gray-300 text-lg">管理個人通知和管理員私訊</p>
        </div>

        {/* 標籤頁 */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'notifications'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
            }`}
          >
            <FaBell className="inline-block mr-2" />
            通知記錄
          </button>
          <button
            onClick={() => setActiveTab('send')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'send'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
            }`}
          >
            <FaEnvelope className="inline-block mr-2" />
            發送通知
          </button>
        </div>

        {/* 通知記錄 */}
        {activeTab === 'notifications' && (
          <div className="bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FaBell className="text-blue-400" />
              個人通知記錄
            </h2>
            
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <FaBell className="text-6xl text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">尚無通知記錄</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`bg-gray-700/50 rounded-lg p-4 border-l-4 ${
                      notification.isImportant ? 'border-red-500' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notification.type)}
                        <h3 className="font-semibold text-white">{notification.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                        {notification.isImportant && (
                          <span className="px-2 py-1 bg-red-600 text-white rounded-full text-xs font-medium">
                            重要
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        {notification.isRead ? (
                          <FaCheckCircle className="text-green-500" />
                        ) : (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        <span>{new Date(notification.createdAt).toLocaleString('zh-TW')}</span>
                      </div>
                    </div>
                    
                    <p className="text-gray-300 mb-3">{notification.content}</p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <div>
                        <span>發送給: </span>
                        <span className="text-white">{notification.user.name} ({notification.user.email})</span>
                      </div>
                      <div>
                        <span>發送者: </span>
                        <span className="text-white">{notification.sender.name}</span>
                      </div>
                    </div>
                    
                    {notification.expiresAt && (
                      <div className="mt-2 text-sm text-gray-400">
                        <span>過期時間: </span>
                        <span className="text-white">{new Date(notification.expiresAt).toLocaleString('zh-TW')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 發送通知 */}
        {activeTab === 'send' && (
          <div className="bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FaEnvelope className="text-green-400" />
              發送個人通知
            </h2>
            
            <form onSubmit={handleSendNotification} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  選擇用戶 *
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">請選擇用戶</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  通知標題 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輸入通知標題"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  通知內容 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="輸入通知內容"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    通知類型
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INFO">一般資訊</option>
                    <option value="WARNING">警告</option>
                    <option value="VIOLATION">違規</option>
                    <option value="REMINDER">提醒</option>
                    <option value="SYSTEM">系統通知</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    優先級
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">低</option>
                    <option value="MEDIUM">中</option>
                    <option value="HIGH">高</option>
                    <option value="URGENT">緊急</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  過期時間 (可選)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isImportant}
                    onChange={(e) => setFormData({ ...formData, isImportant: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-gray-300">標記為重要通知</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.sendEmail}
                    onChange={(e) => setFormData({ ...formData, sendEmail: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-gray-300">同時發送 Email</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
              >
                發送通知
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
