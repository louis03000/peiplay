'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  senderId: string;
  senderType: 'user' | 'partner';
  content: string;
  createdAt: string;
}

interface ChatRoom {
  chatId: string;
  isClosed: boolean;
  createdAt: string;
  expiresAt: string;
  messageCount: number;
  status: string;
  messages: ChatMessage[];
}

export default function PreChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const isPollingRef = useRef(false);

  // 載入聊天室資訊
  useEffect(() => {
    if (!chatId || !session?.user?.id) return;

    const loadRoom = async () => {
      try {
        // 從 URL 參數獲取 partnerId
        const urlParams = new URLSearchParams(window.location.search);
        const partnerId = urlParams.get('partnerId');
        
        if (partnerId) {
          // 使用 partnerId 獲取或創建房間
          const roomRes = await fetch(`/api/chatrooms?partnerId=${partnerId}`);
          if (roomRes.ok) {
            const roomData = await roomRes.json();
            setRoom(roomData);
            setMessages(roomData.messages || []);
            if (roomData.messages && roomData.messages.length > 0) {
              lastTimestampRef.current = roomData.messages[roomData.messages.length - 1].createdAt;
            }
            setLoading(false);
          } else {
            setLoading(false);
          }
        } else {
          // 如果沒有 partnerId，直接使用 chatId 查詢訊息
          const res = await fetch(`/api/chatrooms/${chatId}/messages`);
          if (res.ok) {
            const messagesData = await res.json();
            setMessages(messagesData.messages || []);
            if (messagesData.messages && messagesData.messages.length > 0) {
              lastTimestampRef.current = messagesData.messages[messagesData.messages.length - 1].createdAt;
            }
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading room:', error);
        setLoading(false);
      }
    };

    loadRoom();
  }, [chatId, session?.user?.id]);

  // 輪詢新訊息（長輪詢）
  useEffect(() => {
    if (!chatId || !session?.user?.id || !room || room.isClosed) return;
    if (isPollingRef.current) return;

    isPollingRef.current = true;

    const poll = async () => {
      try {
        const since = lastTimestampRef.current || undefined;
        const url = since
          ? `/api/chatrooms/${chatId}/messages?since=${since}`
          : `/api/chatrooms/${chatId}/messages`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages((prev) => {
              // 去重並合併
              const existingIds = new Set(prev.map((m) => m.id));
              const newMessages = data.messages.filter(
                (m: ChatMessage) => !existingIds.has(m.id)
              );
              const merged = [...prev, ...newMessages].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              if (merged.length > 0) {
                lastTimestampRef.current =
                  merged[merged.length - 1].createdAt;
              }
              return merged;
            });
          }
        }
      } catch (error) {
        console.error('Error polling messages:', error);
      }

      // 繼續輪詢（2-5 秒間隔）
      if (!document.hidden && room && !room.isClosed) {
        pollIntervalRef.current = setTimeout(poll, 3000);
      }
    };

    // 立即開始第一次輪詢
    poll();

    // 可見性檢查：頁面隱藏時暫停輪詢
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollIntervalRef.current) {
          clearTimeout(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } else {
        if (!pollIntervalRef.current && room && !room.isClosed) {
          poll();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isPollingRef.current = false;
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [chatId, session?.user?.id, room]);

  // 滾動到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 發送訊息
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sending || !room || room.isClosed) return;

    const trimmedContent = messageInput.trim();
    setMessageInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/chatrooms/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: trimmedContent }),
      });

      if (res.ok) {
        const data = await res.json();
        // 立即更新訊息列表（樂觀更新）
        const newMessage: ChatMessage = {
          id: data.messageId,
          senderId: session?.user?.id || '',
          senderType: 'user',
          content: trimmedContent,
          createdAt: data.createdAt,
        };
        setMessages((prev) => [...prev, newMessage]);
        lastTimestampRef.current = data.createdAt;

        // 更新房間狀態
        if (room) {
          setRoom({
            ...room,
            messageCount: room.messageCount + 1,
            status: room.messageCount + 1 >= 10 ? 'locked' : room.status,
            isClosed: room.messageCount + 1 >= 10,
          });
        }
      } else {
        const error = await res.json();
        alert(error.error || '發送失敗');
        setMessageInput(trimmedContent); // 恢復輸入
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert('發送失敗，請重試');
      setMessageInput(trimmedContent); // 恢復輸入
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">載入中...</p>
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
            onClick={() => router.push('/partners')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            返回陪玩師列表
          </button>
        </div>
      </div>
    );
  }

  const isLocked = room.isClosed || room.status === 'locked' || room.messageCount >= 10;
  const remainingMessages = Math.max(0, 10 - room.messageCount);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              ← 返回
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">預聊</h1>
              <p className="text-xs text-gray-500 mt-1">
                剩餘訊息：{remainingMessages} / 10
              </p>
            </div>
          </div>
        </div>
        {isLocked && (
          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            <p className="text-sm text-yellow-800">
              ⚠️ 聊天室已關閉（已達上限或已過期）
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>還沒有訊息，開始聊天吧！</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.senderId === session?.user?.id;
            const showDate =
              index === 0 ||
              new Date(message.createdAt).getDate() !==
                new Date(messages[index - 1].createdAt).getDate();

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
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mt-4`}
                >
                  <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : ''}`}>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {format(new Date(message.createdAt), 'HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="bg-white border-t border-gray-200 px-4 py-3"
      >
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder={isLocked ? '聊天室已關閉' : '輸入訊息...'}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending || isLocked}
          />
          <button
            type="submit"
            disabled={
              !messageInput.trim() || sending || isLocked
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '發送中...' : '發送'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          提示：訊息會在 24 小時後自動過期
        </p>
      </form>
    </div>
  );
}

