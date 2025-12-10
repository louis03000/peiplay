import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

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

interface UseChatSocketOptions {
  roomId: string | null;
  enabled?: boolean;
}

export function useChatSocket({ roomId, enabled = true }: UseChatSocketOptions) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 連接 Socket.IO
  useEffect(() => {
    if (!enabled || !session?.user?.id || !roomId) return;

    // 優先使用環境變數，否則使用相對路徑（適用於同域部署）
    let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    
    // 如果沒有配置，嘗試使用當前域名的 Socket Server（如果部署在同一域名下）
    if (!socketUrl && typeof window !== 'undefined') {
      // 假設 Socket Server 在 /socket.io 路徑下（需要 Next.js API route 代理）
      // 或者使用當前域名的 5000 端口（僅開發環境）
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        socketUrl = 'http://localhost:5000';
      } else {
        // 生產環境：如果沒有配置，跳過連接
        console.warn('Socket.IO URL not configured, real-time features disabled');
        setIsConnected(false);
        return;
      }
    }
    
    if (!socketUrl) {
      setIsConnected(false);
      return;
    }
    
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        userId: session.user.id,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
      autoConnect: true,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket.IO connected');
      setIsConnected(true);
      
      // 加入聊天室
      socket.emit('room:join', { roomId });
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
      setIsConnected(false);
    });

    socket.on('error', (error: { message: string }) => {
      console.error('Socket.IO error:', error);
    });

    // 接收新訊息
    socket.on('message:new', (message: ChatMessage) => {
      setMessages((prev) => {
        // 避免重複
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    });

    // 訊息被拒絕
    socket.on('message:rejected', (data: { messageId: string; reason?: string }) => {
      console.warn('Message rejected:', data.reason);
      // 可以顯示錯誤提示
    });

    // Typing indicator
    socket.on('typing:start', (data: { userId: string; roomId: string }) => {
      if (data.roomId === roomId && data.userId !== session.user.id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
      }
    });

    socket.on('typing:stop', (data: { userId: string; roomId: string }) => {
      if (data.roomId === roomId) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
      }
    });

    // Online status
    socket.on('user:online', (data: { userId: string; isOnline: boolean }) => {
      setOnlineMembers((prev) => {
        const next = new Set(prev);
        if (data.isOnline) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    socket.on('room:online-members', (data: { roomId: string; members: string[] }) => {
      if (data.roomId === roomId) {
        setOnlineMembers(new Set(data.members));
      }
    });

    // 已讀回條
    socket.on('message:read', (data: { messageId: string; userId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, status: 'READ' as const }
            : msg
        )
      );
    });

    return () => {
      if (socket && roomId) {
        socket.emit('room:leave', { roomId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, session?.user?.id, roomId]);

  // 發送訊息（如果 WebSocket 不可用，回退到 API）
  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!roomId || !content.trim()) {
        throw new Error('訊息內容不能為空');
      }

      // 如果 WebSocket 已連接，使用 WebSocket 發送
      if (socketRef.current?.connected) {
        return new Promise((resolve, reject) => {
          let resolved = false;
          const trimmedContent = content.trim();

          // 設置錯誤監聽器（一次性）
          const errorHandler = (error: { message: string }) => {
            if (resolved) return;
            resolved = true;
            socketRef.current?.off('error', errorHandler);
            socketRef.current?.off('message:new', messageHandler);
            reject(new Error(error.message));
          };

          // 設置成功監聽器（當收到新消息時表示成功）
          const messageHandler = (message: ChatMessage) => {
            if (resolved) return;
            // 檢查是否是我們剛發送的消息
            if (message.senderId === session?.user?.id && message.content === trimmedContent) {
              resolved = true;
              socketRef.current?.off('error', errorHandler);
              socketRef.current?.off('message:new', messageHandler);
              resolve();
            }
          };

          socketRef.current.once('error', errorHandler);
          socketRef.current.once('message:new', messageHandler);

          // 發送消息
          socketRef.current.emit('message:send', {
            roomId,
            content: trimmedContent,
          });

          // 設置超時（5秒）
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              socketRef.current?.off('error', errorHandler);
              socketRef.current?.off('message:new', messageHandler);
              resolve(); // 即使沒有確認也resolve，因為消息可能已經發送
            }
          }, 5000);
        });
      }

      // 否則使用 API 發送（後備方案）
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
      // 將訊息添加到本地狀態（模擬 WebSocket 接收）
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) {
          return prev;
        }
        return [...prev, {
          id: data.message.id,
          roomId: data.message.roomId,
          senderId: data.message.senderId,
          sender: data.message.sender,
          content: data.message.content,
          contentType: data.message.contentType,
          status: data.message.status,
          moderationStatus: data.message.moderationStatus,
          createdAt: data.message.createdAt,
        }];
      });
    },
    [roomId, session?.user?.id]
  );

  // 開始輸入（typing indicator）
  const startTyping = useCallback(() => {
    if (!socketRef.current || !roomId) return;

    socketRef.current.emit('typing:start', { roomId });

    // 清除之前的 timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // 3 秒後自動停止 typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [roomId]);

  // 停止輸入
  const stopTyping = useCallback(() => {
    if (!socketRef.current || !roomId) return;

    socketRef.current.emit('typing:stop', { roomId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [roomId]);

  // 標記訊息為已讀
  const markAsRead = useCallback(
    (messageIds: string[]) => {
      if (!socketRef.current || !roomId) return;

      messageIds.forEach((messageId) => {
        socketRef.current?.emit('message:read', { messageId, roomId });
      });
    },
    [roomId]
  );

  return {
    messages,
    isConnected,
    typingUsers: Array.from(typingUsers),
    onlineMembers: Array.from(onlineMembers),
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  };
}

