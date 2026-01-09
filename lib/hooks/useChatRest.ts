import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  sender: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;
  };
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'SYSTEM';
  status: 'SENT' | 'DELIVERED' | 'READ';
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  createdAt: string;
}

interface UseChatRestOptions {
  roomId: string | null;
  enabled?: boolean;
  pollInterval?: number; // 輪詢間隔（毫秒），默認 2500ms
}

/**
 * 純 REST API 聊天 Hook（無 WebSocket）
 * 使用輪詢機制獲取新消息
 */
export function useChatRest({ 
  roomId, 
  enabled = true,
  pollInterval = 2500 
}: UseChatRestOptions) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const pollingInFlightRef = useRef(false);
  const stoppedRef = useRef(false);

  // 載入消息
  const loadMessages = useCallback(async (limit = 10) => {
    if (!roomId || !session?.user?.id || pollingInFlightRef.current) return;

    try {
      pollingInFlightRef.current = true;
      const response = await fetch(`/api/chat/rooms/${roomId}/messages?limit=${limit}`);
      
      if (!response.ok) {
        console.error('Failed to load messages:', response.status);
        return;
      }

      const data = await response.json();
      if (data.messages && Array.isArray(data.messages)) {
        const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
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

        // 更新消息（去重）
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = formattedMessages.filter((m) => !existingIds.has(m.id));
          const allMessages = [...prev, ...newMessages];
          
          // 按時間排序
          return allMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });

        // 更新最後消息時間
        if (formattedMessages.length > 0) {
          const latest = formattedMessages[formattedMessages.length - 1];
          lastMessageAtRef.current = latest.createdAt;
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      pollingInFlightRef.current = false;
    }
  }, [roomId, session?.user?.id]);

  // 輪詢新消息（使用 meta API 先檢查是否有新消息）
  const pollForNewMessages = useCallback(async () => {
    if (!roomId || !session?.user?.id || stoppedRef.current || pollingInFlightRef.current) {
      return;
    }

    try {
      pollingInFlightRef.current = true;

      // 先檢查 meta，避免不必要的消息查詢
      const metaRes = await fetch(`/api/chat/rooms/${roomId}/meta`);
      if (metaRes.ok) {
        const meta = await metaRes.json();
        
        // 如果有新消息，才載入
        if (meta.lastMessageAt && meta.lastMessageAt !== lastMessageAtRef.current) {
          await loadMessages(10);
        }
      }
    } catch (error) {
      console.error('Error polling for messages:', error);
    } finally {
      pollingInFlightRef.current = false;
    }
  }, [roomId, session?.user?.id, loadMessages]);

  // 初始載入消息
  useEffect(() => {
    if (!enabled || !roomId || !session?.user?.id) {
      setMessages([]);
      return;
    }

    // 初始載入
    loadMessages(10);

    // 開始輪詢
    stoppedRef.current = false;
    const startPolling = () => {
      if (stoppedRef.current) return;
      
      const delay = document.hidden ? 15000 : pollInterval; // 頁面隱藏時延長間隔
      pollingRef.current = setTimeout(() => {
        pollForNewMessages().then(() => {
          if (!stoppedRef.current) {
            startPolling();
          }
        });
      }, delay);
    };

    startPolling();

    // 頁面可見性變化時立即輪詢
    const handleVisibilityChange = () => {
      if (!document.hidden && !pollingInFlightRef.current && !stoppedRef.current) {
        pollForNewMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stoppedRef.current = true;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, roomId, session?.user?.id, loadMessages, pollForNewMessages, pollInterval]);

  // 發送消息（純 REST API）
  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!roomId || !content.trim()) {
        throw new Error('訊息內容不能為空');
      }

      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || '發送訊息失敗');
      }

      const data = await res.json();
      
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

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });

        lastMessageAtRef.current = newMessage.createdAt;
      }
    },
    [roomId]
  );

  // 標記消息為已讀（純 REST API）
  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!roomId || messageIds.length === 0) return;

      try {
        await fetch(`/api/chat/rooms/${roomId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds }),
        });

        // 更新本地狀態
        setMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg.id) ? { ...msg, status: 'READ' as const } : msg
          )
        );
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    },
    [roomId]
  );

  // Typing 功能（可選，使用 API 或移除）
  const startTyping = useCallback(() => {
    // REST-only 模式下，typing 指示器可以移除或使用 API
    // 這裡保留接口但不實現，避免破壞現有代碼
  }, []);

  const stopTyping = useCallback(() => {
    // REST-only 模式下，typing 指示器可以移除或使用 API
  }, []);

  return {
    messages,
    isConnected: true, // REST API 總是"連接"的
    typingUsers: Array.from(typingUsers),
    onlineMembers: Array.from(onlineMembers),
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    loadMessages, // 暴露手動載入方法
  };
}
