'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useChatSocket } from '@/lib/hooks/useChatSocket';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

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
  status: 'SENT' | 'DELIVERED' | 'READ';
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  createdAt: string;
}

interface RoomDetail {
  id: string;
  type: 'ONE_ON_ONE' | 'GROUP';
  members: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
  }>;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    loadRooms();
  }, [status, router]);

  // 自動選擇第一個聊天室
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
      // 從列表直接構建 RoomDetail，避免額外請求
      const firstRoom = rooms[0];
      setSelectedRoom({
        id: firstRoom.id,
        type: firstRoom.type,
        members: firstRoom.members,
      });
    }
  }, [rooms, selectedRoomId]);

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
        const loadedRooms = data.rooms || [];
        setRooms(loadedRooms);
        
        // 如果有新創建的聊天室，自動選擇第一個
        if (loadedRooms.length > 0 && !selectedRoomId) {
          const firstRoom = loadedRooms[0];
          setSelectedRoomId(firstRoom.id);
          setSelectedRoom({
            id: firstRoom.id,
            type: firstRoom.type,
            members: firstRoom.members,
          });
        }
      } else {
        setError('載入聊天室失敗');
      }
      
      // 處理創建結果（非阻塞，不影響顯示）
      if (createRes.status === 'fulfilled' && createRes.value.ok) {
        const createData = await createRes.value.json();
        if (createData.created > 0) {
          // 如果有新創建的聊天室，重新載入列表（在背景執行）
          fetch('/api/chat/rooms')
            .then((res) => res.json())
            .then((data) => {
              setRooms(data.rooms || []);
            })
            .catch(() => {
              // 忽略錯誤，不影響用戶體驗
            });
        }
      }
    } catch (err) {
      console.error('Error loading rooms:', err);
      setError('載入聊天室失敗');
    } finally {
      setLoading(false);
    }
  };

  const {
    messages: socketMessages,
    isConnected,
    typingUsers,
    onlineMembers,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useChatSocket({ roomId: selectedRoomId, enabled: !!selectedRoomId });

  // 從列表更新選中的聊天室詳情（避免額外請求）
  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoom(null);
      return;
    }

    // 從已載入的列表中查找，避免額外 API 請求
    const roomFromList = rooms.find((r) => r.id === selectedRoomId);
    if (roomFromList) {
      setSelectedRoom({
        id: roomFromList.id,
        type: roomFromList.type,
        members: roomFromList.members,
      });
    } else {
      // 如果列表中沒有，才發起請求（通常不會發生）
      const loadRoom = async () => {
        try {
          const res = await fetch(`/api/chat/rooms/${selectedRoomId}`);
          if (res.ok) {
            const data = await res.json();
            setSelectedRoom(data.room);
          }
        } catch (error) {
          console.error('Error loading room:', error);
        }
      };
      loadRoom();
    }
  }, [selectedRoomId, rooms]);

  // 滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [socketMessages, typingUsers]);

  // 標記已讀
  useEffect(() => {
    if (socketMessages.length > 0 && session?.user?.id && selectedRoomId) {
      const unreadMessageIds = socketMessages
        .filter(
          (msg) =>
            msg.senderId !== session.user.id &&
            msg.status !== 'READ' &&
            msg.moderationStatus !== 'REJECTED'
        )
        .map((msg) => msg.id);

      if (unreadMessageIds.length > 0) {
        markAsRead(unreadMessageIds);
      }
    }
  }, [socketMessages, session?.user?.id, selectedRoomId, markAsRead]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending || !selectedRoomId) return;

    setSending(true);
    try {
      await sendMessage(messageInput);
      setMessageInput('');
      stopTyping();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const getRoomTitle = (room: ChatRoom | RoomDetail | null) => {
    if (!room) return '聊天室';
    if (room.type === 'ONE_ON_ONE') {
      const otherMember = room.members.find((m) => m.id !== session?.user?.id);
      return otherMember?.name || otherMember?.email || '未知用戶';
    }
    return '群組聊天';
  };

  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) {
      const userId = typingUsers[0];
      const user = selectedRoom?.members.find((m) => m.id === userId);
      return `${user?.name || '有人'} 正在輸入...`;
    }
    return '多人正在輸入...';
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
    <div className="flex h-[calc(100vh-80px)] bg-gray-50">
      {/* 左側：聊天室列表 */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">聊天室</h1>
          <p className="mt-1 text-sm text-gray-500">與客戶或陪玩進行即時對話</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400 mx-4 mt-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>還沒有聊天室</p>
              <p className="mt-2 text-sm">當您有訂單時，聊天室會自動建立</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    // 立即更新選中的聊天室，避免延遲
                    setSelectedRoom({
                      id: room.id,
                      type: room.type,
                      members: room.members,
                    });
                  }}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedRoomId === room.id ? 'bg-gray-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900 truncate">
                          {getRoomTitle(room)}
                        </h3>
                        {room.unreadCount > 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                      <div className="ml-4 flex-shrink-0 text-xs text-gray-500">
                        {new Date(room.lastMessageAt).toLocaleDateString('zh-TW', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右側：聊天對話 */}
      <div className="hidden md:flex flex-1 flex-col bg-white">
        {selectedRoomId && selectedRoom ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{getRoomTitle(selectedRoom)}</h1>
                  <div className="flex items-center mt-1">
                    {isConnected ? (
                      <span className="text-xs text-green-600">● 線上</span>
                    ) : (
                      <span className="text-xs text-gray-400">● 離線</span>
                    )}
                    {onlineMembers.length > 0 && (
                      <span className="ml-2 text-xs text-gray-500">
                        {onlineMembers.length} 人在線
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {socketMessages
                .filter((msg) => msg.moderationStatus !== 'REJECTED')
                .map((message, index) => {
                  const isOwn = message.senderId === session?.user?.id;
                  const showAvatar =
                    index === 0 ||
                    socketMessages[index - 1]?.senderId !== message.senderId;
                  const showDate =
                    index === 0 ||
                    new Date(message.createdAt).getDate() !==
                      new Date(socketMessages[index - 1].createdAt).getDate();

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-center my-4">
                          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {format(new Date(message.createdAt), 'yyyy年MM月dd日', {
                              locale: zhTW,
                            })}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                          showAvatar ? 'mt-4' : 'mt-1'
                        }`}
                      >
                        {!isOwn && showAvatar && (
                          <div className="flex-shrink-0 mr-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                              {message.sender.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          </div>
                        )}
                        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : ''}`}>
                          {!isOwn && showAvatar && (
                            <p className="text-xs text-gray-500 mb-1">
                              {message.sender.name || message.sender.email}
                            </p>
                          )}
                          <div
                            className={`rounded-lg px-4 py-2 ${
                              isOwn
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-900 border border-gray-200'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            {message.moderationStatus === 'FLAGGED' && (
                              <p className="text-xs text-yellow-600 mt-1">
                                ⚠️ 此訊息已標記，等待審查
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 text-right">
                            {format(new Date(message.createdAt), 'HH:mm')}
                            {isOwn && message.status === 'READ' && (
                              <span className="ml-1">✓✓</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {getTypingText() && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <p className="text-sm text-gray-500 italic">{getTypingText()}</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-0" />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 px-4 py-3 relative">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  onBlur={stopTyping}
                  placeholder="輸入訊息..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? '發送中...' : '發送'}
                </button>
              </div>
              {/* 不顯示連接錯誤，避免用戶困惑 */}
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg">選擇一個聊天室開始對話</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

