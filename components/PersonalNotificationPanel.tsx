'use client'

import { useState, useEffect } from 'react';
import { FaBell, FaExclamationTriangle, FaInfoCircle, FaClock, FaCheckCircle, FaTimes } from 'react-icons/fa';

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
  sender: {
    id: string;
    name: string;
  };
}

export default function PersonalNotificationPanel() {
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/personal-notifications');
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('獲取個人通知失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/personal-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
    } catch (error) {
      console.error('標記已讀失敗:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/personal-notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      });
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    } catch (error) {
      console.error('標記全部已讀失敗:', error);
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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="relative">
        <button className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10">
          <FaBell className="text-lg sm:text-xl" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 通知按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
        aria-label="個人通知"
      >
        <FaBell className="text-lg sm:text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知面板 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 通知內容 */}
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl z-50 border border-gray-100 overflow-hidden max-h-[calc(100vh-5rem)] flex flex-col">
            {/* 標題欄 */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-white/20 rounded-lg flex-shrink-0">
                    <FaBell className="text-white text-sm" />
                  </div>
                  <h3 className="text-white font-medium text-xs sm:text-sm tracking-wide whitespace-nowrap">
                    個人通知
                  </h3>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="min-h-[32px] px-2 text-xs text-blue-100 hover:text-white transition-colors font-medium rounded-lg hover:bg-white/10 flex-shrink-0 whitespace-nowrap"
                  >
                    全部已讀
                  </button>
                )}
              </div>
            </div>

            {/* 通知列表 */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <FaBell className="text-2xl text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">暫無通知</p>
                  <p className="text-gray-400 text-xs mt-1">您目前沒有新的通知</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`p-1.5 rounded-lg ${
                            notification.type === 'WARNING' ? 'bg-yellow-100' :
                            notification.type === 'VIOLATION' ? 'bg-red-100' :
                            notification.type === 'REMINDER' ? 'bg-blue-100' :
                            notification.type === 'SYSTEM' ? 'bg-gray-100' :
                            'bg-indigo-100'
                          }`}>
                            {getTypeIcon(notification.type)}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium text-sm ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h4>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                            {notification.isImportant && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                重要
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-xs text-gray-600 mb-2 line-clamp-2 leading-relaxed ${
                            !notification.isRead ? 'font-medium' : ''
                          }`}>
                            {notification.content}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="font-medium">
                              {new Date(notification.createdAt).toLocaleDateString('zh-TW', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              {notification.isRead ? (
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              ) : (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                              <span className="text-gray-400">來自: {notification.sender.name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border-t border-gray-100 flex-shrink-0">
              <p className="text-xs text-gray-500 text-center font-medium">
                點擊通知可標記為已讀
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
