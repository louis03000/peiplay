'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useChatSocket } from '@/lib/hooks/useChatSocket';
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

interface ChatRoom {
  id: string;
  type: 'ONE_ON_ONE' | 'GROUP';
  bookingId: string | null;
  groupBookingId: string | null;
  multiPlayerBookingId: string | null;
  members?: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    };
  }>;
}

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false); // 改为 false，立即显示 UI
  const [loadingMessages, setLoadingMessages] = useState(false); // 单独的状态用于消息加载
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]); // 樂觀更新的消息
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 檢查是否是免費聊天室（沒有關聯booking）
  const isFreeChat = Boolean(
    room && !room.bookingId && !room.groupBookingId && !room.multiPlayerBookingId
  );
  const FREE_CHAT_LIMIT = 5;

  // ✅ 關鍵優化：延後 WebSocket 初始化，直到 messages 載入完成
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  
  const {
    messages: socketMessages,
    isConnected,
    typingUsers,
    onlineMembers,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useChatSocket({ 
    roomId, 
    enabled: !!roomId && messagesLoaded // ✅ 只在 messages 載入後才啟用 socket
  });

  // ✅ 關鍵優化：延後載入聊天室資訊（不阻塞首屏）
  useEffect(() => {
    if (!roomId) return;

    // 延後 500ms 載入（首屏優先顯示 messages）
    const timeoutId = setTimeout(() => {
      const loadRoomInfo = async () => {
        try {
          const roomRes = await fetch(`/api/chat/rooms/${roomId}`);
          if (roomRes.ok) {
            const roomData = await roomRes.json();
            setRoom(roomData.room);
            
            // 計算免費聊天句數（如果需要的話，先從房間信息判斷）
            const currentRoom = roomData.room;
            const isFreeChatRoom =
              currentRoom &&
              !currentRoom.bookingId &&
              !currentRoom.groupBookingId &&
              !currentRoom.multiPlayerBookingId;
            
            if (isFreeChatRoom && session?.user?.id) {
              // 先設置為0，等消息加載後再更新
              setUserMessageCount(0);
            }
          }
        } catch (error: any) {
          console.error('Error loading room:', error);
        }
      };

      loadRoomInfo();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [roomId, session?.user?.id]);

  // ✅ 關鍵優化：載入歷史訊息（後台加載，不阻塞 UI）
  const [loadedHistoryMessages, setLoadedHistoryMessages] = useState<ChatMessage[]>([]);
  const lastRoomIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!roomId || !session?.user?.id) {
      setLoadedHistoryMessages([]);
      return;
    }

    // ✅ 如果 roomId 沒變化，不重新載入
    if (lastRoomIdRef.current === roomId) {
      return;
    }

    // ✅ Request lock：防止重複請求
    if (loadingRef.current) {
      // 如果正在載入，先取消之前的請求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }

    loadingRef.current = true;
    lastRoomIdRef.current = roomId;

    // ✅ Abort 之前的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        console.log(`📥 Loading messages for room: ${roomId} (limit=10 for fast first screen)`);
        const messagesRes = await fetch(
          `/api/chat/rooms/${roomId}/messages?limit=10`, // ✅ 首屏只載入 10 則訊息
          { signal: abortController.signal }
        );
        
        if (abortController.signal.aborted) {
          console.log('Request aborted');
          return;
        }
        
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          const cacheStatus = messagesRes.headers.get('X-Cache');
          console.log(`📥 Messages loaded (cache: ${cacheStatus || 'unknown'})`);
          
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
            setMessagesLoaded(true); // ✅ 標記 messages 已載入，允許啟用 socket
            
            // 計算用戶已發送的消息數量（僅計算免費聊天室）
            const currentRoom = room;
            const isFreeChatRoom =
              currentRoom &&
              !currentRoom.bookingId &&
              !currentRoom.groupBookingId &&
              !currentRoom.multiPlayerBookingId;

            if (isFreeChatRoom) {
              const userSentCount = formattedMessages.filter(
                (msg: ChatMessage) => msg.senderId === session.user.id
              ).length;
              setUserMessageCount(userSentCount);
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Request aborted');
          return;
        }
        console.error('Error loading messages:', error);
      } finally {
        setLoadingMessages(false);
        loadingRef.current = false;
      }
    };

    // ✅ 立即加載消息（背景執行，不阻塞 UI）
    loadMessages();
  }, [roomId, session?.user?.id]); // ✅ 關鍵：依賴 roomId，切換房間時重新載入

  // 滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [socketMessages, typingUsers, optimisticMessages]);

  // 標記已讀
  useEffect(() => {
    if (socketMessages.length > 0 && session?.user?.id) {
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

      // 更新用戶發送的消息數量（僅免費聊天室）
      if (isFreeChat) {
        // 合併歷史消息和 socket 消息來計算
        const allMessages = [...loadedHistoryMessages, ...socketMessages];
        const userSentCount = allMessages.filter(
          (msg) => msg.senderId === session.user.id && !msg.id.startsWith('temp-')
        ).length;
        setUserMessageCount(userSentCount);
      }
    }
  }, [socketMessages, session?.user?.id, markAsRead, isFreeChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    // 檢查免費聊天室的消息限制
    if (isFreeChat && userMessageCount >= FREE_CHAT_LIMIT) {
      alert(`免費聊天句數上限為${FREE_CHAT_LIMIT}句，您已達到上限`);
      return;
    }

    const trimmedContent = messageInput.trim();
    if (!trimmedContent) return;

    setSending(true);
    // 樂觀更新：立即清空輸入框並顯示消息
    setMessageInput('');
    stopTyping();

    // 創建樂觀更新的臨時消息
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      roomId,
      senderId: session?.user?.id || '',
      sender: {
        id: session?.user?.id || '',
        name: session?.user?.name || null,
        email: session?.user?.email || '',
        role: session?.user?.role || 'USER',
      },
      content: trimmedContent,
      contentType: 'TEXT',
      status: 'SENT',
      moderationStatus: 'APPROVED',
      createdAt: new Date().toISOString(),
    };

    // 立即顯示樂觀更新的消息
    setOptimisticMessages((prev) => [...prev, optimisticMessage]);

    // 更新消息計數（樂觀更新）
    if (isFreeChat) {
      setUserMessageCount((prev) => prev + 1);
    }

    // 異步發送，不阻塞 UI
    sendMessage(trimmedContent)
      .then(() => {
        // 發送成功，移除樂觀更新的消息
        // 實際消息會通過 socket 或 API 返回並添加到 socketMessages
        // 延遲移除，確保實際消息已經到達
        setTimeout(() => {
          setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        }, 1000); // 給足夠時間讓消息通過API或socket返回
      })
      .catch((error: any) => {
        console.error('Error sending message:', error);
        // 發送失敗，移除樂觀更新的消息並恢復輸入
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        setMessageInput(trimmedContent); // 恢復輸入內容

        // 如果是免費聊天限制錯誤，顯示提示並回退計數
        if (error?.message?.includes('免費聊天句數上限')) {
          alert(error.message);
          // 重置計數為實際值
          if (isFreeChat && session?.user?.id) {
            const allMessages = [...loadedHistoryMessages, ...socketMessages];
            const actualCount = allMessages.filter(
              (msg) => msg.senderId === session.user.id && !msg.id.startsWith('temp-')
            ).length;
            setUserMessageCount(actualCount);
          }
        } else {
          // 其他錯誤，回退計數
          if (isFreeChat) {
            setUserMessageCount((prev) => Math.max(0, prev - 1));
          }
        }
      })
      .finally(() => {
        setSending(false);
      });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const getRoomTitle = () => {
    if (!room) {
      return roomId ? '載入中...' : '聊天室';
    }
    if (room.type === 'ONE_ON_ONE' && room.members) {
      const otherMember = room.members.find((m) => m.user?.id !== session?.user?.id);
      return otherMember?.user?.name || otherMember?.user?.email || '未知用戶';
    }
    return '群組聊天';
  };

  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) {
      const userId = typingUsers[0];
      const user = room?.members?.find((m) => m.user?.id === userId);
      return `${user?.user?.name || '有人'} 正在輸入...`;
    }
    return '多人正在輸入...';
  };

  // 只在房間 ID 無效時顯示錯誤，否則立即顯示 UI
  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">聊天室不存在</p>
          <button
            onClick={() => router.push('/chat')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            返回聊天室列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        {/* 免費聊天提示 */}
        {isFreeChat && (
          <div className="mb-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
            <p className="text-sm text-purple-800 font-medium">
              免費聊天句數上限為5句
              <span className="ml-2 text-purple-600">
                （已使用 {userMessageCount}/{FREE_CHAT_LIMIT} 句）
              </span>
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/chat')}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              ← 返回
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{getRoomTitle()}</h1>
              <div className="flex items-center mt-1">
                {isConnected ? (
                  <span className="text-xs text-green-600">● 線上</span>
                ) : (
                  <span className="text-xs text-gray-400">離線</span>
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
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {/* ✅ 關鍵優化：立即顯示 skeleton，不阻塞 UI */}
        {loadingMessages && loadedHistoryMessages.length === 0 && socketMessages.length === 0 && optimisticMessages.length === 0 && (
          <div className="space-y-4">
            {/* Skeleton 消息 */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md ${i % 2 === 0 ? 'order-2' : ''}`}>
                  <div className="rounded-lg px-4 py-2 bg-gray-200 animate-pulse">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  </div>
                  <div className="h-3 w-16 bg-gray-200 rounded mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* 合併歷史消息、實際消息和樂觀更新的消息 */}
        {(() => {
          // 合併所有消息，去重
          const allMessagesMap = new Map<string, ChatMessage>();
          
          // 先添加歷史消息
          loadedHistoryMessages.forEach(msg => {
            allMessagesMap.set(msg.id, msg);
          });
          
          // 再添加 socket 消息（會覆蓋重複的歷史消息）
          socketMessages.forEach(msg => {
            allMessagesMap.set(msg.id, msg);
          });
          
          // 最後添加樂觀更新的消息（臨時消息）
          optimisticMessages.forEach(msg => {
            allMessagesMap.set(msg.id, msg);
          });
          
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
                            decoding="async"
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
                        {/* ⚠️ 舊訊息可能沒有 senderName，顯示「未知用戶」是預期行為 */}
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={handleInputChange}
            onBlur={stopTyping}
            placeholder={
              isFreeChat && userMessageCount >= FREE_CHAT_LIMIT
                ? '已達到免費聊天上限'
                : '輸入訊息...'
            }
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending || (isFreeChat && userMessageCount >= FREE_CHAT_LIMIT)}
          />
          <button
            type="submit"
            disabled={
              !messageInput.trim() ||
              sending ||
              (isFreeChat && userMessageCount >= FREE_CHAT_LIMIT)
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '發送中...' : '發送'}
          </button>
        </div>
        {!isConnected && (
          <p className="mt-2 text-xs text-yellow-600">
            ⚠️ 即時連線不可用，訊息將通過 API 發送（功能正常）
          </p>
        )}
      </form>
    </div>
  );
}

