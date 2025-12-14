# 📦 聊天室效能優化 - PR Skeleton

> **可直接交給 Cursor AI 或工程團隊使用**

---

## 1. Frontend 修改

### 1.1 ChatRoomPage（立即 Render + Skeleton）

```tsx
// app/chat/[roomId]/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useChatSocket } from '@/lib/hooks/useChatSocket';

export default function ChatRoomPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const initializedRef = useRef(false);
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    messages: socketMessages,
    isConnected,
    sendMessage,
  } = useChatSocket({ roomId, enabled: !!roomId });

  // ✅ 關鍵：立即 render，不阻塞
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadMessagesBackground();
  }, []); // 空依賴陣列

  const loadMessagesBackground = async () => {
    // ✅ Request lock
    if (loadingRef.current) return;
    loadingRef.current = true;

    // ✅ Abort 之前的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoadingMessages(true);
      const res = await fetch(
        `/api/chat/rooms/${roomId}/messages?limit=30`,
        { signal: abortController.signal }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
      loadingRef.current = false;
    }
  };

  // 合併歷史消息和 socket 消息
  const allMessages = [
    ...messages,
    ...socketMessages.filter(
      (msg) => !messages.some((m) => m.id === msg.id)
    ),
  ].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header - 立即顯示 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold">聊天室</h1>
      </div>

      {/* Messages - 立即顯示 skeleton */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingMessages && messages.length === 0 ? (
          <MessageSkeleton />
        ) : (
          <MessageList messages={allMessages} />
        )}
      </div>

      {/* Input - 立即顯示 */}
      <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="輸入訊息..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            發送
          </button>
        </div>
      </form>
    </div>
  );
}

// MessageSkeleton 組件
function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-xs lg:max-w-md">
            <div className="rounded-lg px-4 py-2 bg-gray-200 animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
            <div className="h-3 w-16 bg-gray-200 rounded mt-1"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 1.2 ChatPage（延後非必要 API）

```tsx
// app/chat/page.tsx

useEffect(() => {
  if (initializedRef.current) return;
  initializedRef.current = true;

  // ✅ 立即載入聊天室列表
  loadRooms();

  // ✅ 延後 1 秒載入非必要 API
  setTimeout(() => {
    fetch('/api/chat/rooms/create-for-my-bookings', {
      method: 'POST',
    }).catch(() => {
      // 忽略錯誤，不影響用戶體驗
    });
  }, 1000);
}, []);
```

### 1.3 useChatSocket（Singleton）

```typescript
// lib/hooks/useChatSocket.ts

let globalSocket: Socket | null = null;
let globalSocketInitialized = false;

export function useChatSocket({ roomId, enabled = true }: UseChatSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const currentRoomIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !session?.user?.id) return;

    // ✅ 關鍵：只初始化一次
    if (initializedRef.current && globalSocket) {
      setIsConnected(globalSocket.connected);

      // 切換房間（不重新連接）
      if (roomId && roomId !== currentRoomIdRef.current) {
        if (currentRoomIdRef.current) {
          globalSocket.emit('room:leave', { roomId: currentRoomIdRef.current });
        }
        currentRoomIdRef.current = roomId;
        globalSocket.emit('room:join', { roomId });
      }
      return;
    }

    // 初始化 socket（只執行一次）
    if (!globalSocket) {
      globalSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
        transports: ['websocket'],
        auth: { token: session.user.id },
      });
      globalSocketInitialized = true;
      initializedRef.current = true;
    }

    const socket = globalSocket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (roomId) {
        currentRoomIdRef.current = roomId;
        socket.emit('room:join', { roomId });
      }
    });

    socket.on('message', (message: ChatMessage) => {
      if (message.roomId === currentRoomIdRef.current) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      if (globalSocket && currentRoomIdRef.current) {
        globalSocket.emit('room:leave', { roomId: currentRoomIdRef.current });
        currentRoomIdRef.current = null;
      }
    };
  }, [enabled, session?.user?.id]); // 不依賴 roomId

  // ... sendMessage, startTyping, stopTyping, markAsRead ...
}
```

### 1.4 Avatar（Lazy + CDN）

```tsx
// app/chat/[roomId]/page.tsx

function getOptimizedAvatarUrl(avatarUrl: string): string {
  if (!avatarUrl) return '';
  
  if (avatarUrl.includes('res.cloudinary.com')) {
    if (avatarUrl.includes('/w_') || avatarUrl.includes('/c_')) {
      return avatarUrl.replace(/\/w_\d+/g, '/w_48').replace(/\/h_\d+/g, '/h_48');
    }
    const parts = avatarUrl.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/w_48,h_48,q_auto,c_fill,f_auto/${parts[1]}`;
    }
  }
  return avatarUrl;
}

// 使用
<img
  src={getOptimizedAvatarUrl(message.senderAvatarUrl || '')}
  alt={message.senderName || '用戶'}
  className="w-8 h-8 rounded-full object-cover"
  loading="lazy"
  decoding="async"
  onError={(e) => {
    // 載入失敗時顯示 placeholder
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent) {
      parent.innerHTML = `<div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-sm">${(message.senderName || '?')[0]?.toUpperCase() || '?'}</div>`;
    }
  }}
/>
```

---

## 2. Backend 修改

### 2.1 GET /messages（Cache + 單表查詢）

```typescript
// app/api/chat/rooms/[roomId]/messages/route.ts

import { Cache } from '@/lib/redis-cache';

export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);
    const before = searchParams.get('before');

    // ✅ 先查 cache
    const cacheKey = `messages:${roomId}:${limit}:${before || 'latest'}`;
    const cached = await Cache.get(cacheKey);
    
    if (cached) {
      return NextResponse.json(
        { messages: cached },
        {
          headers: {
            'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
          },
        }
      );
    }

    // Cache miss：查 DB（單表查詢，不 JOIN）
    const result = await db.query(async (client) => {
      // 驗證權限
      const [membership, user] = await Promise.all([
        client.chatRoomMember.findUnique({
          where: { roomId_userId: { roomId, userId: session.user.id } },
          select: { id: true },
        }),
        client.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        }),
      ]);

      if (!membership && user?.role !== 'ADMIN') {
        throw new Error('無權限訪問此聊天室');
      }

      const where: any = {
        roomId,
        moderationStatus: { not: 'REJECTED' },
      };

      if (before) {
        where.createdAt = { lt: new Date(before) };
      }

      // ✅ 單表查詢，使用 denormalized 字段
      const messages = await (client as any).chatMessage.findMany({
        where,
        select: {
          id: true,
          roomId: true,
          senderId: true,
          senderName: true,        // denormalized
          senderAvatarUrl: true,   // denormalized
          content: true,
          contentType: true,
          status: true,
          moderationStatus: true,
          createdAt: true,
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: limit,
      });

      return messages.reverse().map((msg: any) => ({
        id: msg.id,
        roomId: msg.roomId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderAvatarUrl: msg.senderAvatarUrl,
        content: msg.content,
        contentType: msg.contentType,
        status: msg.status,
        moderationStatus: msg.moderationStatus,
        createdAt: msg.createdAt,
        sender: {
          id: msg.senderId,
          name: msg.senderName,
          email: '',
          role: '',
          avatarUrl: msg.senderAvatarUrl,
        },
      }));
    }, 'chat:rooms:roomId:messages:get');

    // ✅ 寫入 cache（fire-and-forget）
    if (result && Array.isArray(result)) {
      Cache.set(cacheKey, result, 3).catch((err: any) => {
        console.error('Failed to cache messages:', err);
      });
    }

    return NextResponse.json(
      { messages: result },
      {
        headers: {
          'Cache-Control': 'private, max-age=3, stale-while-revalidate=5',
        },
      }
    );
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:get');
  }
}
```

### 2.2 POST /messages（Insert-Only + Queue）

```typescript
// app/api/chat/rooms/[roomId]/messages/route.ts

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { roomId } = params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 });
    }

    // ✅ 只做 insert，立即回傳
    const result = await db.query(async (client) => {
      // 驗證權限
      const membership = await (client as any).chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: session.user.id,
          },
        },
      });

      if (!membership) {
        throw new Error('無權限訪問此聊天室');
      }

      // 獲取用戶信息（用於 denormalize）
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          email: true,
          partner: {
            select: {
              coverImage: true,
            },
          },
        },
      });

      const senderName = user?.name || session.user.email || '未知用戶';
      const avatarUrl = user?.partner?.coverImage || null;

      // ✅ 只做 insert
      const message = await (client as any).chatMessage.create({
        data: {
          roomId,
          senderId: session.user.id,
          senderName: senderName,
          senderAvatarUrl: avatarUrl,
          content: content.trim(),
          contentType: 'TEXT',
          status: 'SENT',
          moderationStatus: 'APPROVED',
        },
      });

      // ✅ 其他工作丟到 queue（非同步）
      if (typeof queue !== 'undefined') {
        queue.add('postMessageJobs', {
          messageId: message.id,
          roomId: message.roomId,
        });
      }

      return {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderAvatarUrl: message.senderAvatarUrl,
        content: message.content,
        contentType: message.contentType,
        status: message.status,
        moderationStatus: message.moderationStatus,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.senderId,
          name: message.senderName,
          email: '',
          role: '',
          avatarUrl: message.senderAvatarUrl,
        },
      };
    }, 'chat:rooms:roomId:messages:post');

    return NextResponse.json({ message: result });
  } catch (error) {
    return createErrorResponse(error, 'chat:rooms:roomId:messages:post');
  }
}
```

---

## 3. Worker（Bull Queue）

```typescript
// workers/message-processor.ts

import Queue from 'bull';
import { prisma } from '@/lib/prisma';
import { io } from '@/socket-server';
import { Cache } from '@/lib/redis-cache';

const messageQueue = new Queue('postMessageJobs', process.env.REDIS_URL!);

messageQueue.process(async (job) => {
  const { messageId, roomId } = job.data;

  try {
    // 1. 獲取消息
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // 2. 更新 room.lastMessageAt（非同步，不阻塞）
    prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: message.createdAt },
    }).catch((err) => {
      console.error('Failed to update lastMessageAt:', err);
    });

    // 3. 推送 socket（只發給該房間）
    io.to(roomId).emit('message', message);

    // 4. 清除 cache
    const cachePattern = `messages:${roomId}:*`;
    await Cache.deletePattern(cachePattern).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error('Error processing message job:', error);
    throw error;
  }
});

export { messageQueue };
```

---

## 4. Database Migration（必須手動執行）

```sql
-- ⚠️ 必須在 maintenance window 執行

-- Step 1: 添加 denormalized 字段
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立複合索引（CONCURRENTLY 不鎖表）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- Step 3: 驗證索引
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'test-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;

-- 預期結果：Index Scan using ChatMessage_roomId_createdAt_idx
-- Execution Time: < 100ms
```

---

## 5. Rate Limiting

```typescript
// lib/rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { Cache } from '@/lib/redis-cache';

export async function rateLimit(
  req: NextRequest,
  options: {
    windowMs: number;
    maxRequests: number;
    keyGenerator: (req: NextRequest) => string;
  }
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = options.keyGenerator(req);
  const cacheKey = `rate:${key}`;

  const current = await Cache.get<number>(cacheKey) || 0;

  if (current >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + options.windowMs,
    };
  }

  await Cache.set(cacheKey, current + 1, Math.ceil(options.windowMs / 1000));

  return {
    allowed: true,
    remaining: options.maxRequests - current - 1,
    resetTime: Date.now() + options.windowMs,
  };
}

// 使用範例
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  // ✅ Rate limit：每用戶 3 條/秒，burst 5 條
  const limit = await rateLimit(request, {
    windowMs: 1000,
    maxRequests: 3,
    keyGenerator: (req) => `user:${session.user.id}`,
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      { status: 429 }
    );
  }

  // ... 處理請求 ...
}
```

---

## 6. Socket Server（Room-Based）

```typescript
// socket-server/src/index.ts

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

// ✅ 關鍵：使用 Redis adapter（多台 server 時）
if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  });
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  // ... 驗證邏輯 ...
  next();
});

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // ✅ 關鍵：join room
  socket.on('room:join', ({ roomId }) => {
    socket.join(roomId);
    console.log(`🏠 Socket ${socket.id} joined room: ${roomId}`);
  });

  socket.on('room:leave', ({ roomId }) => {
    socket.leave(roomId);
    console.log(`🚪 Socket ${socket.id} left room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// ✅ 關鍵：只發給特定房間
io.to(roomId).emit('message', message);
```

---

## 7. 環境變數

```bash
# .env
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SOCKET_URL=wss://socket.peiplay.com
```

---

## 8. 部署 Worker

```bash
# 使用 PM2
pm2 start workers/message-processor.ts --name message-worker

# 或使用 Docker
docker run -d \
  -e REDIS_URL=$REDIS_URL \
  your-image:latest \
  node workers/message-processor.js
```

---

**完整細節請見**：`docs/CHAT_PERFORMANCE_COMPLETE_FIX.md`

