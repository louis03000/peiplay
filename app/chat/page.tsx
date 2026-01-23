'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
// REST-only: WebSocket removed
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

// ✅ 優化頭像 URL（使用 Cloudinary resize）
function getOptimizedAvatarUrl(avatarUrl: string): string {
  if (!avatarUrl) return '';
  
  // 如果是 Cloudinary 圖片，添加 resize 參數（64x64，自動品質）
  if (avatarUrl.includes('res.cloudinary.com')) {
    // 檢查是否已經有轉換參數
    if (avatarUrl.includes('/w_') || avatarUrl.includes('/c_')) {
      // 如果已有轉換參數，替換為優化的尺寸
      return avatarUrl.replace(/\/w_\d+/g, '/w_64').replace(/\/h_\d+/g, '/h_64').replace(/\/q_\d+/g, '/q_auto');
    }
    // 如果沒有轉換參數，添加優化參數
    // Cloudinary URL 格式：https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}
    const parts = avatarUrl.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/w_64,h_64,q_auto,c_fill,f_auto/${parts[1]}`;
    }
  }
  
  return avatarUrl;
}

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
  senderName?: string | null;      // 去正規化字段
  senderAvatarUrl?: string | null; // 去正規化字段
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;     // 頭像 URL
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
  const [loadedHistoryMessages, setLoadedHistoryMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false); // 防止重複初始化
  const loadingMessagesRef = useRef<Map<string, AbortController>>(new Map()); // API 請求去重

  // ✅ 關鍵優化：首屏只 fetch messages，其他 API 延後
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    
    // 防止重複初始化
    if (initializedRef.current) {
      console.log('⚠️ Chat already initialized, skipping');
      return;
    }
    
    console.log('🚀 Chat initialized');
    initializedRef.current = true;
    
    // ✅ 首屏只載入聊天室列表（messages 會在選擇聊天室時載入）
    loadRooms();
    
    // ✅ 延後其他非必要 API（不阻塞首屏）
    // 這些 API 會在背景載入，不影響首屏速度
    setTimeout(() => {
      // 延後 1 秒載入 create-for-my-bookings（已在 loadRooms 中處理）
    }, 1000);
  }, [status]); // ✅ 關鍵：不依賴 router，避免重複初始化

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
      console.log('📋 Loading rooms...');
      
      // 優先載入聊天室列表（快速顯示）
      const roomsRes = await fetch('/api/chat/rooms');
      
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        const loadedRooms = data.rooms || [];
        setRooms(loadedRooms);
        console.log(`✅ Loaded ${loadedRooms.length} rooms`);
        
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
    } catch (err) {
      console.error('Error loading rooms:', err);
      setError('載入聊天室失敗');
    } finally {
      setLoading(false);
    }
  };

  // ✅ 關鍵優化：延後創建聊天室（不阻塞首屏）
  // 獨立 useEffect，延遲 2 秒後執行，確保首屏已經渲染完成
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    
    // 延遲 2 秒後再執行，確保首屏已經渲染完成
    const timeoutId = setTimeout(() => {
      console.log('⏰ Delayed: Creating rooms for bookings (non-blocking)');
      fetch('/api/chat/rooms/create-for-my-bookings', {
        method: 'POST',
      })
        .then((res) => res.ok && res.json())
        .then((createData) => {
          if (createData?.created > 0) {
            console.log(`🆕 Created ${createData.created} new rooms`);
            // 如果有新創建的聊天室，重新載入列表
            return fetch('/api/chat/rooms')
              .then((res) => res.json())
              .then((data) => {
                setRooms(data.rooms || []);
              });
          }
        })
        .catch((err) => {
          // 忽略錯誤，不影響用戶體驗
          console.warn('Failed to create rooms for bookings:', err);
        });
    }, 2000); // ✅ 延遲 2 秒，確保首屏已經渲染

    return () => clearTimeout(timeoutId);
  }, [status, session?.user?.id]);

  // REST-only: 移除 WebSocket，使用純 REST API
  // 這個頁面主要顯示聊天室列表，不需要實時消息更新

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
  }, [loadedHistoryMessages]);

  // ✅ 載入歷史訊息（當選擇聊天室時）- 添加請求去重
  useEffect(() => {
    if (!selectedRoomId || !session?.user?.id) {
      setLoadedHistoryMessages([]);
      return;
    }

    // 如果已經有進行中的請求，取消它
    const existingController = loadingMessagesRef.current.get(selectedRoomId);
    if (existingController) {
      console.log(`⚠️ Aborting duplicate messages request for room ${selectedRoomId}`);
      existingController.abort();
    }

    // 創建新的 AbortController
    const abortController = new AbortController();
    loadingMessagesRef.current.set(selectedRoomId, abortController);

    const loadMessages = async () => {
      try {
        console.log(`📥 Loading messages for room: ${selectedRoomId} (limit=10 for fast first screen)`);
        const messagesRes = await fetch(`/api/chat/rooms/${selectedRoomId}/messages?limit=10`, {
          signal: abortController.signal,
        });
        
        if (abortController.signal.aborted) {
          console.log(`⚠️ Messages request aborted for room ${selectedRoomId}`);
          return;
        }
        
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          if (messagesData.messages && Array.isArray(messagesData.messages)) {
            // 將歷史消息轉換為 ChatMessage 格式（支持 denormalized 字段）
            const formattedMessages: ChatMessage[] = messagesData.messages.map((msg: any) => ({
              id: msg.id,
              roomId: msg.roomId,
              senderId: msg.senderId,
              senderName: msg.senderName || msg.sender?.name,
              senderAvatarUrl: msg.senderAvatarUrl || msg.sender?.avatarUrl,
              sender: {
                id: msg.senderId,
                name: msg.senderName || msg.sender?.name || null,
                email: msg.sender?.email || '',
                role: msg.sender?.role || '',
                avatarUrl: msg.senderAvatarUrl || msg.sender?.avatarUrl || null,
              },
              content: msg.content,
              contentType: msg.contentType || 'TEXT',
              status: msg.status || 'SENT',
              moderationStatus: msg.moderationStatus || 'APPROVED',
              createdAt: msg.createdAt,
            }));
            setLoadedHistoryMessages(formattedMessages);
            console.log(`✅ Loaded ${formattedMessages.length} messages for room ${selectedRoomId}`);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`⚠️ Messages request aborted for room ${selectedRoomId}`);
          return;
        }
        console.error('Error loading messages:', error);
      } finally {
        loadingMessagesRef.current.delete(selectedRoomId);
      }
    };

    loadMessages();
    
    // 清理函數：取消請求
    return () => {
      abortController.abort();
      loadingMessagesRef.current.delete(selectedRoomId);
    };
  }, [selectedRoomId]); // ❌ 移除 session?.user?.id 依賴（不應該因為 session 變化而重新載入）

  // 標記已讀
  useEffect(() => {
    if (loadedHistoryMessages.length > 0 && session?.user?.id && selectedRoomId) {
      const unreadMessageIds = loadedHistoryMessages
        .filter(
          (msg) =>
            msg.senderId !== session.user.id &&
            msg.status !== 'READ' &&
            msg.moderationStatus !== 'REJECTED'
        )
        .map((msg) => msg.id);

      if (unreadMessageIds.length > 0) {
        // REST API 標記已讀
        fetch(`/api/chat/rooms/${selectedRoomId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds: unreadMessageIds }),
        }).catch(console.error);
      }
    }
  }, [loadedHistoryMessages, session?.user?.id, selectedRoomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending || !selectedRoomId) return;

    setSending(true);
    try {
      // REST API 發送消息
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageInput.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || '發送訊息失敗');
      }

      const data = await res.json();
      setMessageInput('');
      
      // 將新消息添加到本地狀態
      if (data.message) {
        const newMessage: ChatMessage = {
          id: data.message.id,
          roomId: data.message.roomId,
          senderId: data.message.senderId,
          senderName: data.message.senderName,
          senderAvatarUrl: data.message.senderAvatarUrl,
          sender: data.message.sender,
          content: data.message.content,
          contentType: data.message.contentType || 'TEXT',
          status: data.message.status || 'SENT',
          moderationStatus: data.message.moderationStatus || 'APPROVED',
          createdAt: data.message.createdAt,
        };
        setLoadedHistoryMessages((prev) => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert(error instanceof Error ? error.message : '發送訊息失敗');
    } finally {
      setSending(false);
    }
  };

  const stopTyping = () => {
    // REST-only: typing 指示器已移除
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    // REST-only: typing 指示器已移除
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
    // REST-only: typing 指示器已移除
    return null;
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
              {/* ✅ 只顯示有消息記錄的聊天室 */}
              {rooms
                .filter((room) => room.lastMessageAt && room.lastMessage) // 只顯示有消息的
                .map((room) => (
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
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {(() => {
                // 合併歷史消息，去重（REST-only）
                const allMessagesMap = new Map<string, ChatMessage>();
                
                // 先添加歷史消息
                loadedHistoryMessages.forEach(msg => {
                  allMessagesMap.set(msg.id, msg);
                });
                
                // REST-only: 只使用歷史消息
                
                return Array.from(allMessagesMap.values())
                  .filter((msg) => msg.moderationStatus !== 'REJECTED')
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
              })().map((message, index, allMessages) => {
                  const isOwn = message.senderId === session?.user?.id;
                  const showAvatar =
                    index === 0 ||
                    allMessages[index - 1]?.senderId !== message.senderId;
                  const showDate =
                    index === 0 ||
                    new Date(message.createdAt).getDate() !==
                      new Date(allMessages[index - 1].createdAt).getDate();

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
                            {/* ✅ 顯示發送者頭像（使用 denormalized 字段） */}
                            {message.senderAvatarUrl || message.sender?.avatarUrl ? (
                              <div className="w-8 h-8 rounded-full overflow-hidden relative">
                                <img
                                  src={getOptimizedAvatarUrl(message.senderAvatarUrl || message.sender?.avatarUrl || '')}
                                  alt={message.senderName || message.sender?.name || '用戶'}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    // 如果圖片載入失敗，顯示預設頭像
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-sm font-medium">${(message.senderName || message.sender?.name || '?')[0]?.toUpperCase() || '?'}</div>`;
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-sm font-medium">
                                {(message.senderName || message.sender?.name || '?')[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : ''}`}>
                      {!isOwn && showAvatar && (
                        <p className="text-xs text-gray-500 mb-1">
                          {message.senderName || message.sender?.name || message.sender?.email || '未知用戶'}
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

