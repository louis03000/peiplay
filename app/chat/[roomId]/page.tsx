'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useChatSocket } from '@/lib/hooks/useChatSocket';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

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

  // 檢查是否是免費聊天室（沒有關聯booking）
  const isFreeChat = Boolean(
    room && !room.bookingId && !room.groupBookingId && !room.multiPlayerBookingId
  );
  const FREE_CHAT_LIMIT = 5;

  const {
    messages: socketMessages,
    isConnected,
    typingUsers,
    onlineMembers,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useChatSocket({ roomId, enabled: !!roomId });

  // 載入聊天室資訊（優先，快速顯示）
  useEffect(() => {
    if (!roomId) return;

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
  }, [roomId, session?.user?.id]);

  // 載入歷史訊息（後台加載，不阻塞 UI）
  useEffect(() => {
    if (!roomId || !session?.user?.id) return;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const messagesRes = await fetch(`/api/chat/rooms/${roomId}/messages?limit=20`); // 減少到20條，加快加載
        
        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          // 計算用戶已發送的消息數量（僅計算免費聊天室）
          if (messagesData.messages) {
            const currentRoom = room;
            const isFreeChatRoom =
              currentRoom &&
              !currentRoom.bookingId &&
              !currentRoom.groupBookingId &&
              !currentRoom.multiPlayerBookingId;

            if (isFreeChatRoom) {
              const userSentCount = messagesData.messages.filter(
                (msg: ChatMessage) => msg.senderId === session.user.id
              ).length;
              setUserMessageCount(userSentCount);
            }
          }
        }
      } catch (error: any) {
        console.error('Error loading messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    // 延遲加載消息，讓 UI 先顯示
    const timer = setTimeout(loadMessages, 100);
    return () => clearTimeout(timer);
  }, [roomId, room, session?.user?.id]);

  // 滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [socketMessages, typingUsers]);

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
        const userSentCount = socketMessages.filter(
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
        // 發送成功，移除樂觀更新的消息（實際消息會通過 socket 或 API 返回）
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
      })
      .catch((error: any) => {
        console.error('Error sending message:', error);
        // 發送失敗，移除樂觀更新的消息並恢復輸入
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        setMessageInput(trimmedContent); // 恢復輸入內容

        // 如果是免費聊天限制錯誤，顯示提示
        if (error?.message?.includes('免費聊天句數上限')) {
          alert(error.message);
          // 重置計數為實際值
          if (isFreeChat && session?.user?.id) {
            const actualCount = socketMessages.filter(
              (msg) => msg.senderId === session.user.id && !msg.id.startsWith('temp-')
            ).length;
            setUserMessageCount(actualCount);
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
              {userMessageCount > 0 && (
                <span className="ml-2 text-purple-600">
                  （已使用 {userMessageCount}/{FREE_CHAT_LIMIT} 句）
                </span>
              )}
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
        {loadingMessages && socketMessages.length === 0 && optimisticMessages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600 text-sm">載入訊息中...</p>
          </div>
        )}
        {/* 合併實際消息和樂觀更新的消息 */}
        {[...socketMessages, ...optimisticMessages]
          .filter((msg) => msg.moderationStatus !== 'REJECTED')
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map((message, index, allMessages) => {
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

