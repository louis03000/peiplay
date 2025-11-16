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

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
    
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        userId: session.user.id,
      },
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

  // 發送訊息
  const sendMessage = useCallback(
    (content: string) => {
      if (!socketRef.current || !roomId || !content.trim()) return;

      socketRef.current.emit('message:send', {
        roomId,
        content: content.trim(),
      });
    },
    [roomId]
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

