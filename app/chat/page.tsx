'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ChatRoom {
  id: string;
  type: 'ONE_ON_ONE' | 'GROUP';
  bookingId: string | null;
  groupBookingId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  members: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
  }>;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    sender: {
      id: string;
      name: string | null;
      email: string;
    };
    createdAt: string;
  } | null;
  booking?: any;
  groupBooking?: any;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    loadRooms();
  }, [status, router]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      
      // 並行執行：同時創建聊天室和載入聊天室列表
      const [createRes, roomsRes] = await Promise.allSettled([
        fetch('/api/chat/rooms/create-for-my-bookings', {
          method: 'POST',
        }),
        fetch('/api/chat/rooms'),
      ]);
      
      // 處理聊天室列表（優先）
      if (roomsRes.status === 'fulfilled' && roomsRes.value.ok) {
        const data = await roomsRes.value.json();
        setRooms(data.rooms || []);
      } else {
        setError('載入聊天室失敗');
      }
      
      // 處理創建結果（非阻塞）
      if (createRes.status === 'fulfilled' && createRes.value.ok) {
        const createData = await createRes.value.json();
        if (createData.created > 0) {
          // 如果有新創建的聊天室，重新載入列表
          const refreshRes = await fetch('/api/chat/rooms');
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            setRooms(refreshData.rooms || []);
          }
        }
      }
    } catch (err) {
      console.error('Error loading rooms:', err);
      setError('載入聊天室失敗');
    } finally {
      setLoading(false);
    }
  };

  const getRoomTitle = (room: ChatRoom) => {
    if (room.type === 'ONE_ON_ONE' && room.booking) {
      const otherMember = room.members.find((m) => m.id !== session?.user?.id);
      return otherMember?.name || otherMember?.email || '未知用戶';
    }
    if (room.type === 'GROUP' && room.groupBooking) {
      return room.groupBooking.title || '群組聊天';
    }
    return '聊天室';
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
            <h1 className="text-2xl font-bold text-gray-900">聊天室</h1>
            <p className="mt-1 text-sm text-gray-500">與客戶或陪玩進行即時對話</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="divide-y divide-gray-200">
            {rooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>還沒有聊天室</p>
                <p className="mt-2 text-sm">當您有訂單時，聊天室會自動建立</p>
              </div>
            ) : (
              rooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/chat/${room.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {getRoomTitle(room)}
                        </h3>
                        {room.unreadCount > 0 && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {room.unreadCount}
                          </span>
                        )}
                      </div>
                      {room.lastMessage && (
                        <p className="mt-1 text-sm text-gray-500 truncate">
                          {room.lastMessage.senderId === session?.user?.id ? '您: ' : ''}
                          {room.lastMessage.content}
                        </p>
                      )}
                    </div>
                    {room.lastMessageAt && (
                      <div className="ml-4 flex-shrink-0 text-sm text-gray-500">
                        {new Date(room.lastMessageAt).toLocaleDateString('zh-TW', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

