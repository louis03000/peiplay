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
        <button className="p-2 text-gray-300 hover:text-white transition-colors">
          <FaBell className="text-xl" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 通知按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
      >
        <FaBell className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
            {/* 標題欄 */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <FaBell className="text-blue-500" />
                  個人通知
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    全部已讀
                  </button>
                )}
              </div>
            </div>

            {/* 通知列表 */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <FaBell className="text-3xl mx-auto mb-2 opacity-50" />
                  <p>暫無通知</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => !notification.isRead && markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getTypeIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-medium text-sm ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h4>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                            {notification.isImportant && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium">
                                重要
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-xs text-gray-600 mb-2 line-clamp-2 ${
                            !notification.isRead ? 'font-medium' : ''
                          }`}>
                            {notification.content}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{new Date(notification.createdAt).toLocaleString('zh-TW')}</span>
                            <div className="flex items-center gap-2">
                              {notification.isRead ? (
                                <FaCheckCircle className="text-green-500" />
                              ) : (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                              <span>來自: {notification.sender.name}</span>
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
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <p className="text-xs text-gray-500 text-center">
                點擊通知可標記為已讀
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
