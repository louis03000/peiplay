'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'SYSTEM';
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  moderationReason: string | null;
  moderationScore: number | null;
  createdAt: string;
  room: {
    id: string;
    type: 'ONE_ON_ONE' | 'GROUP';
    members: Array<{
      id: string;
      name: string | null;
      email: string;
    }>;
    booking?: {
      id: string;
      orderNumber: string | null;
    };
    groupBooking?: {
      id: string;
      title: string | null;
    };
  };
}

interface Stats {
  pending: number;
  flagged: number;
  rejected: number;
}

export default function AdminChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, flagged: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'FLAGGED' | 'REJECTED'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    // 檢查管理員權限
    if (session?.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadMessages();
  }, [status, session, router, filter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const url = `/api/admin/chat${filter !== 'all' ? `?status=${filter}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setStats(data.stats || { pending: 0, flagged: 0, rejected: 0 });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (messageId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, action }),
      });

      if (res.ok) {
        loadMessages();
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error moderating message:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">聊天內容審查</h1>
            <p className="mt-1 text-sm text-gray-500">審查用戶聊天內容，確保合規</p>
          </div>

          {/* Stats */}
          <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-200">
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">待審查</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">已標記</p>
              <p className="text-2xl font-bold text-orange-600">{stats.flagged}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">已拒絕</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex space-x-2">
              {(['all', 'PENDING', 'FLAGGED', 'REJECTED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? '全部' : f === 'PENDING' ? '待審查' : f === 'FLAGGED' ? '已標記' : '已拒絕'}
                </button>
              ))}
            </div>
          </div>

          {/* Messages List */}
          <div className="divide-y divide-gray-200">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>沒有需要審查的訊息</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedMessage(message)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">
                          {message.sender.name || message.sender.email}
                        </p>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            message.moderationStatus === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : message.moderationStatus === 'FLAGGED'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {message.moderationStatus === 'PENDING'
                            ? '待審查'
                            : message.moderationStatus === 'FLAGGED'
                            ? '已標記'
                            : '已拒絕'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{message.content}</p>
                      {message.moderationReason && (
                        <p className="mt-1 text-xs text-gray-500">
                          原因: {message.moderationReason}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(message.createdAt).toLocaleString('zh-TW')}
                      </p>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleModerate(message.id, 'approve');
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        批准
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleModerate(message.id, 'reject');
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        拒絕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">訊息詳情</h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">發送者</p>
                  <p className="font-medium">
                    {selectedMessage.sender.name || selectedMessage.sender.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">內容</p>
                  <p className="mt-1 bg-gray-50 p-3 rounded">{selectedMessage.content}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">狀態</p>
                  <p className="font-medium">{selectedMessage.moderationStatus}</p>
                </div>
                {selectedMessage.moderationReason && (
                  <div>
                    <p className="text-sm text-gray-600">審查原因</p>
                    <p className="mt-1">{selectedMessage.moderationReason}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">時間</p>
                  <p>{new Date(selectedMessage.createdAt).toLocaleString('zh-TW')}</p>
                </div>
              </div>
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => handleModerate(selectedMessage.id, 'approve')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  批准
                </button>
                <button
                  onClick={() => handleModerate(selectedMessage.id, 'reject')}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  拒絕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

