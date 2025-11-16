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
  members: Array<{
    id: string;
    name: string | null;
    email: string;
    role: string;
  }>;
}

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // 載入聊天室資訊和歷史訊息
  useEffect(() => {
    if (!roomId) return;

    const loadRoom = async () => {
      try {
        setLoading(true);
        const [roomRes, messagesRes] = await Promise.all([
          fetch(`/api/chat/rooms/${roomId}`),
          fetch(`/api/chat/rooms/${roomId}/messages?limit=50`),
        ]);

        if (roomRes.ok) {
          const roomData = await roomRes.json();
          setRoom(roomData.room);
        }

        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          // 歷史訊息會通過 Socket.IO 同步，這裡只是初始載入
        }
      } catch (error) {
        console.error('Error loading room:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [roomId]);

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
    }
  }, [socketMessages, session?.user?.id, markAsRead]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending) return;

    setSending(true);
    try {
      sendMessage(messageInput);
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

  const getRoomTitle = () => {
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
      const user = room?.members.find((m) => m.id === userId);
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

  if (!room) {
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
            placeholder="輸入訊息..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!isConnected || sending}
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || !isConnected || sending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '發送中...' : '發送'}
          </button>
        </div>
        {!isConnected && (
          <p className="mt-2 text-xs text-red-600">連接中斷，請重新整理頁面</p>
        )}
      </form>
    </div>
  );
}

