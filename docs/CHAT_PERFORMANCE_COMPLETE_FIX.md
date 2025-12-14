# 🚀 聊天室效能完整修復指南（一次到位版）

> **目標**：首屏 ≤ 2 秒，messages API < 300ms（cache hit < 100ms）
> 
> **適用對象**：可直接交給 Cursor AI 或工程團隊執行
> 
> **驗收標準**：所有項目必須通過，否則視為未完成

---

## 📋 目錄

1. [總覽與優先順序](#總覽與優先順序)
2. [問題 1：前端 Blocking Render](#問題-1前端-blocking-render)
3. [問題 2：GET /messages 太慢](#問題-2get-messages-太慢)
4. [問題 3：POST /messages 同步做太多](#問題-3post-messages-同步做太多)
5. [問題 4：Messages 沒有 Cache](#問題-4messages-沒有-cache)
6. [問題 5：Socket 連線錯誤](#問題-5socket-連線錯誤)
7. [問題 6：前端重複初始化](#問題-6前端重複初始化)
8. [問題 7：Avatar 圖片阻塞](#問題-7avatar-圖片阻塞)
9. [問題 8：Rate Limit / 防刷](#問題-8rate-limit--防刷)
10. [問題 9：部署與 Migration](#問題-9部署與-migration)
11. [驗證與監控](#驗證與監控)
12. [PR Skeleton（可直接使用）](#pr-skeleton可直接使用)
13. [Backfill 腳本](#backfill-腳本)
14. [k6 壓測腳本](#k6-壓測腳本)
15. [驗收檢查清單](#驗收檢查清單)

---

## 總覽與優先順序

### ⚠️ 必須照此順序執行（不可跳過）

1. **立即止血**：前端不阻塞 render + 禁止不必要 API 在首屏
2. **DB 最小存取**：messages 單表查詢 + 複合索引
3. **發送訊息非同步化**：寫入後其他工作丟 queue
4. **Cache（關鍵）**：messages list 用 Redis（TTL 3-5s）
5. **Socket 正確化**：單例 + room-based emit + Redis adapter
6. **防刷/限流**：User/room rate limit
7. **前端防重入**：init 一次 + request lock + skeleton UI
8. **Migration / 部署**：batch backfill + concurrent index
9. **監控與壓測**：APM + EXPLAIN + 壓力測試

---

## 問題 1：前端 Blocking Render

### 🔴 症狀
- 頁面白屏或 spinner 等很久
- Network 顯示 messages API 完成前 UI 不顯示

### 🔴 確切原因
- 前端在 `messages` / `bookings` / `notifications` 等都回來前不 render
- `useEffect` 中使用 `await` 阻塞了 render
- `loading` state 為 `true` 時整個 UI 被隱藏

### ✅ 絕對解法

#### 前端修改（React / Next.js）

**1. 立即 render 聊天室框架，不等待 messages**

```tsx
// app/chat/[roomId]/page.tsx

export default function ChatRoomPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const initializedRef = useRef(false);

  // ✅ 關鍵：立即 render，不阻塞
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // 背景載入，不 await
    loadMessagesBackground();
  }, []);

  const loadMessagesBackground = async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages?limit=30`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // ✅ 立即 render，不等待 messages
  return (
    <div className="flex flex-col h-screen">
      {/* Header - 立即顯示 */}
      <div className="bg-white border-b px-4 py-3">
        <h1>{getRoomTitle()}</h1>
      </div>

      {/* Messages - 立即顯示 skeleton */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loadingMessages && messages.length === 0 ? (
          // ✅ Skeleton UI（不阻塞）
          <MessageSkeleton />
        ) : (
          <MessageList messages={messages} />
        )}
      </div>

      {/* Input - 立即顯示 */}
      <form onSubmit={handleSendMessage} className="bg-white border-t px-4 py-3">
        <input type="text" placeholder="輸入訊息..." />
        <button type="submit">發送</button>
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

**2. 延後非必要 API**

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

### 📝 Cursor 指令

```
請修改聊天室頁面，確保：
1. ChatLayout、InputBar、MessageSkeleton 立即 render（不等待 messages API）
2. messages 載入改為 background fetch，使用 skeleton UI
3. create-for-my-bookings 延後 1 秒載入
4. 移除所有 blocking loading spinner
```

### ✅ 驗證

1. **Network 檢查**：
   - ChatLayout 應先渲染（FCP < 300ms）
   - messages API 可慢，但 UI 立即呈現

2. **手動測試**：
   ```bash
   # 打開 DevTools Performance
   # 記錄頁面載入
   # 檢查 FCP (First Contentful Paint) < 500ms
   ```

---

## 問題 2：GET /messages 太慢

### 🔴 症狀
- messages 查詢 7-10 秒
- Network 顯示長時間等待

### 🔴 確切原因
1. **無複合索引**：查詢使用全表掃描
2. **使用 OFFSET**：分頁效率極低
3. **JOIN users/profiles**：多表查詢慢
4. **無 denormalize**：每次都要 JOIN

### ✅ 絕對解法

#### 1. Database Migration（必須手動執行）

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

#### 2. Backend API 修改

```typescript
// app/api/chat/rooms/[roomId]/messages/route.ts

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
    const before = searchParams.get('before'); // cursor-based pagination

    // ✅ 關鍵優化：單表查詢，不 JOIN
    const result = await db.query(async (client) => {
      // 驗證權限（並行查詢）
      const [membership, user] = await Promise.all([
        client.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: session.user.id,
            },
          },
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

      // ✅ 使用索引查詢（roomId, createdAt DESC）
      const where: any = {
        roomId, // 必須先匹配索引的第一個欄位
        moderationStatus: { not: 'REJECTED' },
      };

      // ✅ Cursor-based pagination（不使用 OFFSET）
      if (before) {
        where.createdAt = { lt: new Date(before) };
      }

      // ✅ 單表查詢，使用 denormalized 字段
      let messages: any[];
      
      try {
        // 嘗試使用 denormalized 字段
        messages = await (client as any).chatMessage.findMany({
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
            // ❌ 不再 JOIN sender
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: limit,
        });

        // 轉換格式
        messages = messages.reverse().map((msg: any) => ({
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
      } catch (error: any) {
        // 回退到 JOIN（migration 未執行時）
        messages = await (client as any).chatMessage.findMany({
          where,
          select: {
            id: true,
            roomId: true,
            senderId: true,
            content: true,
            contentType: true,
            status: true,
            moderationStatus: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                partner: {
                  select: {
                    coverImage: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: limit,
        });

        messages = messages.reverse().map((msg: any) => ({
          id: msg.id,
          roomId: msg.roomId,
          senderId: msg.senderId,
          senderName: msg.sender?.name || null,
          senderAvatarUrl: msg.sender?.partner?.coverImage || null,
          content: msg.content,
          contentType: msg.contentType,
          status: msg.status,
          moderationStatus: msg.moderationStatus,
          createdAt: msg.createdAt,
          sender: {
            id: msg.senderId,
            name: msg.sender?.name || null,
            email: msg.sender?.email || '',
            role: msg.sender?.role || '',
            avatarUrl: msg.sender?.partner?.coverImage || null,
          },
        }));
      }

      return messages;
    }, 'chat:rooms:roomId:messages:get');

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

### 📝 Cursor 指令

```
請修改 GET /messages API：
1. 移除所有 JOIN users/profiles 的查詢
2. 使用 denormalized 字段（senderName, senderAvatarUrl）
3. 改為 cursor-based pagination（不使用 OFFSET）
4. 確保 WHERE 條件先匹配 roomId（索引的第一個欄位）
5. 提供 migration SQL 給 owner 手動執行
```

### ✅ 驗證

1. **Database 檢查**：
   ```sql
   EXPLAIN ANALYZE
   SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
   FROM "ChatMessage"
   WHERE "roomId" = 'your-room-id'
   ORDER BY "createdAt" DESC
   LIMIT 30;
   ```
   
   **預期結果**：
   - Index Scan using ChatMessage_roomId_createdAt_idx
   - Execution Time: < 100ms

2. **API 測試**：
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages?limit=30"
   ```
   
   **預期**：Response time < 300ms（無 cache）

---

## 問題 3：POST /messages 同步做太多

### 🔴 症狀
- 發送訊息慢（> 500ms）
- 高併發時後端被拖爆

### 🔴 確切原因
- POST /messages 同步做：
  - 寫入 message
  - 更新 room.lastMessageAt
  - 計算 unread count
  - 推送 socket
  - 發送通知
  - 清除 cache
  - 更新 analytics

### ✅ 絕對解法

#### 1. 改為 Insert-Only + Queue

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

    // ✅ 關鍵：只做 insert，立即回傳
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
          role: true,
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
          senderName: senderName,        // denormalize
          senderAvatarUrl: avatarUrl,     // denormalize
          content: content.trim(),
          contentType: 'TEXT',
          status: 'SENT',
          moderationStatus: 'APPROVED',
        },
      });

      // ✅ 其他工作丟到 queue（非同步）
      // 注意：需要先設置 queue（見下方 Worker 部分）
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

#### 2. Worker 處理（Bull Queue）

```typescript
// workers/message-processor.ts
import Queue from 'bull';
import { prisma } from '@/lib/prisma';
import { io } from '@/socket-server';

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
    const cacheKey = `messages:${roomId}:latest:30`;
    await redis.del(cacheKey).catch(() => {});

    // 5. 更新 unread count（可選，也可延後）
    // ... unread count logic ...

    // 6. 發送通知（可選）
    // ... notification logic ...

    return { success: true };
  } catch (error) {
    console.error('Error processing message job:', error);
    throw error;
  }
});

export { messageQueue };
```

### 📝 Cursor 指令

```
請修改 POST /messages API：
1. 改為 insert-only，立即回傳新 message（< 200ms）
2. 把 room 更新、unread、socket、cache、通知都丟到 queue
3. 建立 worker 處理 queue（使用 Bull + Redis）
4. Worker 必須處理：room.lastMessageAt、socket emit、cache invalidation
```

### ✅ 驗證

1. **API 測試**：
   ```bash
   time curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content":"test"}' \
     "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages"
   ```
   
   **預期**：Response time < 200ms

2. **Worker 檢查**：
   - Queue length 應該被消化
   - 錯誤率 < 1%

---

## 問題 4：Messages 沒有 Cache

### 🔴 症狀
- 多人同時進同一聊天室時大量 DB 查詢
- messages API 每次都 hit DB

### 🔴 確切原因
- 沒有 cache 機制
- 每次載入都查 DB

### ✅ 絕對解法

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

    // ✅ 關鍵：先查 cache
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

    // Cache miss：查 DB
    const result = await db.query(async (client) => {
      // ... 查詢邏輯（見問題 2）...
      return messages;
    }, 'chat:rooms:roomId:messages:get');

    // ✅ 寫入 cache（fire-and-forget，不阻塞）
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

**Worker 中清除 cache**：

```typescript
// workers/message-processor.ts

// 發送消息後清除 cache
const cachePattern = `messages:${roomId}:*`;
await Cache.deletePattern(cachePattern).catch(() => {});
```

### 📝 Cursor 指令

```
請為 GET /messages 添加 Redis cache：
1. Cache key: messages:{roomId}:{limit}:{before}
2. TTL: 3 秒
3. Cache hit 時直接返回（< 100ms）
4. POST /messages 後清除該房間的 cache
```

### ✅ 驗證

1. **Cache Hit 測試**：
   ```bash
   # 第一次請求（cache miss）
   time curl "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages?limit=30"
   # 預期：< 300ms
   
   # 第二次請求（cache hit）
   time curl "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages?limit=30"
   # 預期：< 100ms
   ```

2. **Redis 檢查**：
   ```bash
   redis-cli
   > KEYS messages:*
   > TTL messages:room123:30:latest
   ```

---

## 問題 5：Socket 連線錯誤

### 🔴 症狀
- 前端可能多次建立 socket
- 後端每條訊息 broadcast 全站

### 🔴 確切原因
- Socket 在 component body 建立
- emit 沒做 room 類別
- 多台 server 沒有 Redis adapter

### ✅ 絕對解法

#### 1. 前端 Socket Singleton

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
        auth: {
          token: session.user.id,
        },
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

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('message', (message: ChatMessage) => {
      // 只添加屬於當前房間的消息
      if (message.roomId === currentRoomIdRef.current) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      // 不 disconnect globalSocket
      if (globalSocket && currentRoomIdRef.current) {
        globalSocket.emit('room:leave', { roomId: currentRoomIdRef.current });
        currentRoomIdRef.current = null;
      }
    };
  }, [enabled, session?.user?.id]); // 不依賴 roomId

  // ... sendMessage, startTyping, stopTyping, markAsRead ...
}
```

#### 2. 後端 Socket Server（Room-Based）

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
  // 驗證 token
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

### 📝 Cursor 指令

```
請修改 Socket 連線：
1. 前端：改為 singleton，只 connect 一次
2. 前端：切換房間時 emit room:join/leave，不重新連接
3. 後端：使用 socket.join(roomId)，只向該房間 emit
4. 後端：如需 scale，使用 Redis adapter
```

### ✅ 驗證

1. **Network 檢查**：
   - WebSocket 連線只有 1 條
   - 切換房間時不重新連接

2. **後端檢查**：
   - 發送消息時只有該房間的客戶端收到

---

## 問題 6：前端重複初始化

### 🔴 症狀
- 同一 API 被呼叫多次
- Network 顯示重複請求

### 🔴 確切原因
- `useEffect` 依賴過多
- 沒有 request lock
- messages state 更新時重新 init

### ✅ 絕對解法

```typescript
// app/chat/[roomId]/page.tsx

export default function ChatRoomPage() {
  const initializedRef = useRef(false);
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    loadMessages();
  }, []); // ✅ 關鍵：空依賴陣列

  const loadMessages = async () => {
    // ✅ 關鍵：request lock
    if (loadingRef.current) return;
    loadingRef.current = true;

    // ✅ 關鍵：abort 之前的請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch(
        `/api/chat/rooms/${roomId}/messages?limit=30`,
        { signal: abortController.signal }
      );
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('Error loading messages:', error);
    } finally {
      loadingRef.current = false;
    }
  };
}
```

### 📝 Cursor 指令

```
請修改前端初始化邏輯：
1. 使用 initializedRef 防止重複初始化
2. 使用 loadingRef 防止重複請求
3. 使用 AbortController 取消重複請求
4. useEffect 依賴陣列改為 []（只在 mount 時執行）
```

### ✅ 驗證

1. **Network 檢查**：
   - messages API 只出現 1 次
   - 切換房間時不重複請求

---

## 問題 7：Avatar 圖片阻塞

### 🔴 症狀
- Avatar 載入阻塞文字出現
- 圖片太大

### 🔴 確切原因
- Avatar 未使用 CDN resize
- 在首屏同步載入
- 未使用 lazy loading

### ✅ 絕對解法

```tsx
// app/chat/[roomId]/page.tsx

// ✅ 優化頭像 URL（使用 CDN resize）
function getOptimizedAvatarUrl(avatarUrl: string): string {
  if (!avatarUrl) return '';
  
  // Cloudinary resize
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

// MessageItem 組件
{message.senderAvatarUrl ? (
  <img
    src={getOptimizedAvatarUrl(message.senderAvatarUrl)}
    alt={message.senderName || '用戶'}
    className="w-8 h-8 rounded-full object-cover"
    loading="lazy"           // ✅ 關鍵：lazy loading
    decoding="async"        // ✅ 關鍵：非阻塞解碼
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
) : (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-sm">
    {(message.senderName || '?')[0]?.toUpperCase() || '?'}
  </div>
)}
```

### 📝 Cursor 指令

```
請修改 avatar 圖片：
1. 使用 CDN resize（w=48, h=48, auto=format）
2. 添加 loading="lazy" 和 decoding="async"
3. 載入失敗時顯示 placeholder（首字母）
```

### ✅ 驗證

1. **Network 檢查**：
   - Avatar 請求小（< 10KB）
   - 文字先出現，avatar 後載入

---

## 問題 8：Rate Limit / 防刷

### 🔴 症狀
- 大量訊息導致服務阻塞
- 被惡意刷

### ✅ 絕對解法

```typescript
// lib/rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { Cache } from '@/lib/redis-cache';

interface RateLimitOptions {
  windowMs: number;      // 時間窗口（毫秒）
  maxRequests: number;   // 最大請求數
  keyGenerator: (req: NextRequest) => string;
}

export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = options.keyGenerator(req);
  const cacheKey = `rate:${key}`;

  // 獲取當前計數
  const current = await Cache.get<number>(cacheKey) || 0;

  if (current >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + options.windowMs,
    };
  }

  // 增加計數
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
    windowMs: 1000, // 1 秒
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

### 📝 Cursor 指令

```
請添加 rate limit：
1. 每用戶：3 條/秒，burst 5 條
2. 每房間：10 條/秒
3. 使用 Redis token bucket
4. 超過限制返回 429
```

### ✅ 驗證

1. **測試**：
   ```bash
   # 快速發送 10 條消息
   for i in {1..10}; do
     curl -X POST "https://api.peiplay.com/api/chat/rooms/ROOM_ID/messages" \
       -H "Authorization: Bearer $TOKEN" \
       -d '{"content":"test"}'
   done
   ```
   
   **預期**：前 3 條成功，後續返回 429

---

## 問題 9：部署與 Migration

### ⚠️ 必須手動執行

#### 1. Database Migration

```sql
-- ⚠️ 必須在 maintenance window 執行
-- Step 1: 添加字段
ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- Step 2: 建立索引（CONCURRENTLY 不鎖表）
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_roomId_createdAt_idx"
ON "ChatMessage"("roomId", "createdAt" DESC);

-- Step 3: 驗證
EXPLAIN ANALYZE
SELECT id, content, "senderName", "senderAvatarUrl", "createdAt"
FROM "ChatMessage"
WHERE "roomId" = 'test-room-id'
ORDER BY "createdAt" DESC
LIMIT 30;
```

#### 2. Backfill（可選）

見下方 [Backfill 腳本](#backfill-腳本)

#### 3. 環境變數

```bash
# .env
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SOCKET_URL=wss://socket.peiplay.com
```

#### 4. 部署 Worker

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

## 驗證與監控

### 檢查清單

- [ ] EXPLAIN ANALYZE messages 查詢：Index Scan & Total < 100ms
- [ ] messages API cold hit < 300ms（最好 < 150ms with cache）
- [ ] ChatLayout FCP < 500ms
- [ ] POST /messages average < 200ms
- [ ] WebSocket: only 1 connection per client
- [ ] 100 concurrent users 測試：DB CPU < 70%，Redis hit ratio > 90%

### 工具

- **APM**：Datadog / NewRelic / Elastic APM
- **Database**：`pg_stat_statements`
- **Redis**：`INFO stats`
- **壓測**：k6 / artillery

---

## PR Skeleton（可直接使用）

見下方完整代碼範例。

---

## Backfill 腳本

```sql
-- 分批更新（每次 1000 筆）
-- 建議：用 cron 或手動 loop，每跑一次 sleep 300ms

UPDATE "ChatMessage" m
SET 
  "senderName" = u.name,
  "senderAvatarUrl" = COALESCE(
    (SELECT "coverImage" FROM "Partner" WHERE "userId" = u.id),
    u.avatar
  )
FROM "User" u
WHERE m."senderId" = u.id
  AND (m."senderName" IS NULL OR m."senderAvatarUrl" IS NULL)
LIMIT 1000;

-- 檢查進度
SELECT 
  COUNT(*) as total,
  COUNT("senderName") as filled_name,
  COUNT("senderAvatarUrl") as filled_avatar
FROM "ChatMessage";
```

---

## k6 壓測腳本

```javascript
// k6/chat-load-test.js
import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // 0 -> 50 users
    { duration: '1m', target: 100 },  // 50 -> 100 users
    { duration: '30s', target: 0 },   // 100 -> 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% < 500ms
    errors: ['rate<0.01'],            // error rate < 1%
  },
};

const BASE_URL = 'https://api.peiplay.com';
const TOKEN = 'YOUR_TEST_TOKEN';
const ROOM_ID = 'test-room-id';

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  // 1. Fetch messages
  const messagesRes = http.get(
    `${BASE_URL}/api/chat/rooms/${ROOM_ID}/messages?limit=30`,
    params
  );
  
  check(messagesRes, {
    'messages status 200': (r) => r.status === 200,
    'messages duration < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(1);

  // 2. Send message
  const sendRes = http.post(
    `${BASE_URL}/api/chat/rooms/${ROOM_ID}/messages`,
    JSON.stringify({ content: `test message ${Date.now()}` }),
    params
  );

  check(sendRes, {
    'send status 200': (r) => r.status === 200,
    'send duration < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(2);
}
```

**執行**：
```bash
k6 run k6/chat-load-test.js
```

---

## 驗收檢查清單

### ✅ 必須全部達成

- [ ] **首屏（ChatLayout + InputBar）FCP < 500ms**
- [ ] **messages API (cache hit) < 150ms**
- [ ] **messages API (cache miss) < 300ms**
- [ ] **POST /messages latency < 200ms (insert only)**
- [ ] **首次完成到可互動（typing/send）≤ 2s**
- [ ] **100 concurrent users 測試下 service 不超過 70% CPU**
- [ ] **Redis hit ratio > 85%**
- [ ] **WebSocket 只有 1 連線 / client**
- [ ] **EXPLAIN ANALYZE 顯示 Index Scan**
- [ ] **Rate limit 正常工作（429 響應）**

---

## 回滾 & 保險措施

### 執行前

1. **備份 Database**：
   ```bash
   pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql
   ```

2. **保留舊版程式**：
   - Git tag: `v1.0.0-pre-optimization`
   - 可快速切回

### 執行中

1. **Canary Release**：
   - 先在 5% 流量測試
   - 監控錯誤率和延遲

2. **Rollback Plan**：
   - 如果新 worker 或 cache 有 bug，可短時間切回舊版 API
   - 停用 queue，直接同步處理

---

## 給 Cursor AI 的完整指令

```
請依照這份完整修復指南，直接幫我完成聊天室效能優化的實作：

1. Frontend：
   - 立即 render ChatLayout + InputBar + MessageSkeleton（不阻塞）
   - Socket: 改為 singleton（只 connect 一次）
   - Avatar: 使用 CDN resize + <img loading="lazy">
   - 防重入：使用 initializedRef 與 request lock
   - 延後非必要 API（create-for-my-bookings）

2. Backend：
   - messages 表新增 sender_name, sender_avatar_url（提供 migration SQL）
   - POST /messages: 改為 insert-only + 把其他工作丟到 queue
   - GET /messages: 改為單表查詢 + Redis cache（TTL 3 秒）
   - 移除 messages 查詢中的任何 JOIN
   - 使用 cursor-based pagination（不使用 OFFSET）

3. Worker：
   - 建立 worker 處理：room.lastMessageAt、socket emit、cache invalidation
   - 使用 Bull + Redis

4. Cache & Infra：
   - 加入 Redis cache（key: messages:{roomId}:{limit}:{before}, TTL 3 秒）
   - 提供環境變數配置說明

5. Rate Limiting：
   - 實作 per-user token bucket (3 msgs/sec, burst 5)

6. 提供：
   - Migration SQL（標示需手動執行）
   - Backfill script
   - k6 壓測腳本
   - Rollback plan
   - 驗收測項（EXPLAIN 指令 & Network expectations）

請把所有變更做成 PR，並標示哪些 DB 指令須由 owner 在 maintenance window 手動執行。
```

---

**完成後，請執行驗收檢查清單，確保所有項目通過。**

