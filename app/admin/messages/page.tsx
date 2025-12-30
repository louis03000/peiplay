'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FaEnvelope, FaUser, FaPaperPlane, FaArrowLeft } from 'react-icons/fa';

interface AdminMessage {
  id: string;
  content: string;
  isRead: boolean;
  isFromAdmin: boolean;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  admin?: {
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

export default function AdminMessagingPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [session]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        // API 返回的是數組，不是 { users: [] }
        const usersList = Array.isArray(data) ? data : (data.users || []);
        setUsers(usersList);
        console.log(`✅ 載入了 ${usersList.length} 個用戶`);
      } else {
        console.error('獲取用戶失敗:', data);
      }
    } catch (error) {
      console.error('獲取用戶失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin-messages?userId=${userId}`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('獲取訊息失敗:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser) {
      return;
    }

    try {
      const res = await fetch('/api/admin-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          content: newMessage,
          isFromAdmin: true
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setNewMessage('');
        fetchMessages(selectedUser.id);
      } else {
        alert(`發送失敗: ${data.error}`);
      }
    } catch (error) {
      console.error('發送訊息失敗:', error);
      alert('發送失敗，請重試');
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
            管理員私訊系統
          </h1>
          <p className="text-gray-300 text-lg mb-4">與用戶進行一對一溝通</p>
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-blue-200 text-sm">
              💡 <strong>使用說明：</strong>在左側搜尋並選擇用戶，然後在右側開始對話。您可以發送訊息給用戶，用戶也可以回覆您的訊息。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 用戶列表 */}
          <div className="bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FaUser className="text-blue-400" />
              用戶列表
            </h2>
            
            {/* 搜尋框 */}
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋用戶名稱或Email..."
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* 用戶列表 */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FaUser className="text-4xl mx-auto mb-2 opacity-50" />
                  <p>沒有用戶</p>
                </div>
              ) : (
                users
                  .filter(user => {
                    if (!searchTerm.trim()) return true;
                    const searchLower = searchTerm.toLowerCase();
                    return (
                      user.name?.toLowerCase().includes(searchLower) ||
                      user.email?.toLowerCase().includes(searchLower)
                    );
                  })
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedUser?.id === user.id
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                      }`}
                    >
                      <div className="font-medium">{user.name || '未命名用戶'}</div>
                      <div className="text-sm opacity-75">{user.email}</div>
                      <div className="text-xs opacity-50 mt-1">
                        {user.role === 'CUSTOMER' ? '顧客' : user.role === 'PARTNER' ? '夥伴' : user.role === 'ADMIN' ? '管理員' : user.role}
                      </div>
                    </button>
                  ))
              )}
              
              {/* 搜尋無結果 */}
              {searchTerm.trim() && users.filter(user => {
                const searchLower = searchTerm.toLowerCase();
                return (
                  user.name?.toLowerCase().includes(searchLower) ||
                  user.email?.toLowerCase().includes(searchLower)
                );
              }).length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>找不到匹配的用戶</p>
                </div>
              )}
            </div>
            
            {/* 用戶統計 */}
            <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
              <p>總共 {users.length} 個用戶</p>
              {searchTerm.trim() && (
                <p>找到 {users.filter(user => {
                  const searchLower = searchTerm.toLowerCase();
                  return (
                    user.name?.toLowerCase().includes(searchLower) ||
                    user.email?.toLowerCase().includes(searchLower)
                  );
                }).length} 個匹配結果</p>
              )}
            </div>
          </div>

          {/* 對話區域 */}
          <div className="lg:col-span-2 bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-2xl p-6">
            {selectedUser ? (
              <>
                {/* 對話標題 */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <FaEnvelope className="text-green-400" />
                    <div>
                      <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                      <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <FaArrowLeft />
                  </button>
                </div>

                {/* 訊息列表 */}
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <FaEnvelope className="text-4xl mx-auto mb-2 opacity-50" />
                      <p>尚無對話記錄</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isFromAdmin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.isFromAdmin
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            message.isFromAdmin ? 'text-blue-200' : 'text-gray-500'
                          }`}>
                            {new Date(message.createdAt).toLocaleString('zh-TW')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 發送訊息表單 */}
                <form onSubmit={sendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="輸入訊息..."
                    className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <FaPaperPlane />
                    發送
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-12">
                <FaEnvelope className="text-6xl text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">請選擇一個用戶開始對話</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
