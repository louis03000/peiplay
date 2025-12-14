import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { moderateMessage } from './moderation';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ✅ 導出 io 供其他模組使用（如 message-queue）
(global as any).socketIO = io;
export { io };

// Redis adapter for horizontal scaling
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Redis adapter connected');
  })
  .catch((err) => {
    console.error('❌ Redis connection failed:', err);
  });

const prisma = new PrismaClient();

// Store online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>();
// Store typing users: roomId -> Map<userId, timestamp>
const typingUsers = new Map<string, Map<string, number>>();

// Middleware: Authentication
io.use(async (socket, next) => {
  const userId = socket.handshake.auth.userId;
  const token = socket.handshake.auth.token;

  if (!userId) {
    return next(new Error('Authentication error: userId required'));
  }

  // TODO: Verify token with your auth system
  // For now, we'll trust the userId from client
  socket.data.userId = userId;
  next();
});

// Track online status
function updateOnlineStatus(userId: string, socketId: string, isOnline: boolean) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  const userSockets = onlineUsers.get(userId)!;

  if (isOnline) {
    userSockets.add(socketId);
  } else {
    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      onlineUsers.delete(userId);
    }
  }

  // Broadcast online status change
  io.emit('user:online', { userId, isOnline: onlineUsers.has(userId) });
}

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`✅ User ${userId} connected (socket: ${socket.id})`);

  // Mark user as online
  updateOnlineStatus(userId, socket.id, true);

  // Join room
  socket.on('room:join', async (data: { roomId: string }) => {
    const { roomId } = data;

    // Verify user has access to this room
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      socket.emit('error', { message: 'Access denied to this room' });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    // Notify others in room
    socket.to(roomId).emit('room:user-joined', { userId, roomId });

    // Send online status of room members
    const roomMembers = await getRoomMembers(roomId);
    const onlineMembers = roomMembers
      .filter((member) => onlineUsers.has(member.userId))
      .map((member) => member.userId);
    socket.emit('room:online-members', { roomId, members: onlineMembers });
  });

  // Leave room
  socket.on('room:leave', (data: { roomId: string }) => {
    const { roomId } = data;
    socket.leave(roomId);
    socket.to(roomId).emit('room:user-left', { userId, roomId });
    socket.data.roomId = undefined;
  });

  // Send message
  socket.on('message:send', async (data: { roomId: string; content: string }) => {
    const { roomId, content } = data;

    // Verify access
    const hasAccess = await verifyRoomAccess(userId, roomId);
    if (!hasAccess) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    // Check free chat limit
    try {
      const room = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: {
          bookingId: true,
          groupBookingId: true,
          multiPlayerBookingId: true,
        },
      });

      const isFreeChat =
        !room?.bookingId && !room?.groupBookingId && !room?.multiPlayerBookingId;

      if (isFreeChat) {
        // Count user's sent messages
        const userMessageCount = await prisma.chatMessage.count({
          where: {
            roomId,
            senderId: userId,
          },
        });

        const FREE_CHAT_LIMIT = 5;
        if (userMessageCount >= FREE_CHAT_LIMIT) {
          socket.emit('error', {
            message: `免費聊天句數上限為${FREE_CHAT_LIMIT}句，您已達到上限`,
          });
          return;
        }
      }
    } catch (error) {
      console.error('Error checking free chat limit:', error);
      // Continue if check fails (don't block message)
    }

    // Content moderation
    const moderationResult = await moderateMessage(content);

    // Save message to database
    try {
      // ✅ 關鍵優化：發送消息時寫入 denormalized 字段（sender_name, sender_avatar_url）
      // 先查詢用戶信息（一次性查詢）
      const user = await prisma.user.findUnique({
        where: { id: userId },
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

      // 獲取頭像 URL（優先使用 partner 的 coverImage）
      const avatarUrl = user?.partner?.coverImage || null;
      const senderName = user?.name || user?.email || '未知用戶';

      const message = await prisma.chatMessage.create({
        data: {
          roomId,
          senderId: userId,
          senderName: senderName,        // 去正規化：寫入發送時的快照
          senderAvatarUrl: avatarUrl,    // 去正規化：寫入發送時的快照
          content,
          contentType: 'TEXT',
          status: 'SENT',
          moderationStatus: moderationResult.status,
          moderationReason: moderationResult.reason || null,
          moderationScore: moderationResult.score || null,
        },
        select: {
          id: true,
          roomId: true,
          senderId: true,
          senderName: true,
          senderAvatarUrl: true,
          content: true,
          contentType: true,
          status: true,
          moderationStatus: true,
          createdAt: true,
          // ❌ 不再 include sender（避免 JOIN）
        },
      });

      // 優化：異步更新 lastMessageAt（不阻塞消息發送）
      prisma.chatRoom
        .update({
          where: { id: roomId },
          data: { lastMessageAt: new Date() },
        })
        .catch((err: any) => {
          // 忽略更新錯誤，不影響消息發送
          console.error('Failed to update lastMessageAt:', err);
        });

      // If message is rejected, don't send to room
      if (moderationResult.status === 'REJECTED') {
        socket.emit('message:rejected', {
          messageId: message.id,
          reason: moderationResult.reason,
        });
        return;
      }

      // Emit to room (including sender)
      const messagePayload = {
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
        // 保持向後兼容的 sender 結構
        sender: {
          id: message.senderId,
          name: message.senderName,
          email: '',
          role: '',
          avatarUrl: message.senderAvatarUrl,
        },
      };

      io.to(roomId).emit('message:new', messagePayload);

      // If flagged, notify admins
      if (moderationResult.status === 'FLAGGED') {
        notifyAdmins(message);
      }
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing:start', (data: { roomId: string }) => {
    const { roomId } = data;
    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Map());
    }
    typingUsers.get(roomId)!.set(userId, Date.now());

    socket.to(roomId).emit('typing:start', { userId, roomId });
  });

  socket.on('typing:stop', (data: { roomId: string }) => {
    const { roomId } = data;
    typingUsers.get(roomId)?.delete(userId);
    socket.to(roomId).emit('typing:stop', { userId, roomId });
  });

  // Mark message as read
  socket.on('message:read', async (data: { messageId: string; roomId: string }) => {
    const { messageId, roomId } = data;

    try {
      // Create or update read receipt
      await prisma.messageReadReceipt.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
        create: {
          messageId,
          userId,
        },
        update: {},
      });

      // Update message status to READ if all members have read
      const roomMembers = await getRoomMembers(roomId);
      const readCount = await prisma.messageReadReceipt.count({
        where: { messageId },
      });

      if (readCount >= roomMembers.length) {
        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { status: 'READ' },
        });
      }

      // Notify sender
      socket.to(roomId).emit('message:read', { messageId, userId });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User ${userId} disconnected (socket: ${socket.id})`);
    updateOnlineStatus(userId, socket.id, false);

    // Clean up typing indicators
    if (socket.data.roomId) {
      typingUsers.get(socket.data.roomId)?.delete(userId);
      socket.to(socket.data.roomId).emit('typing:stop', {
        userId,
        roomId: socket.data.roomId,
      });
    }
  });
});

// Helper functions
async function verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
  try {
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (member) return true;

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === 'ADMIN';
  } catch (error) {
    console.error('Error verifying room access:', error);
    return false;
  }
}

async function getRoomMembers(roomId: string) {
  return prisma.chatRoomMember.findMany({
    where: { roomId, isActive: true },
    select: { userId: true },
  });
}

async function notifyAdmins(message: any) {
  // Get all admin users
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  // Emit to admin sockets
  admins.forEach((admin) => {
    io.to(`admin:${admin.id}`).emit('message:flagged', {
      messageId: message.id,
      roomId: message.roomId,
      content: message.content,
      senderId: message.senderId,
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.SOCKET_PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
});

