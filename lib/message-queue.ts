/**
 * Message Queue for Chat Messages
 * 使用 Redis 作為 queue backend（如果可用），否則降級為同步處理
 */

import { Cache } from './redis-cache';

interface MessageJob {
  messageId: string;
  roomId: string;
}

let queueEnabled = false;

// 檢查 Redis 是否可用
try {
  const testCache = Cache.get('test');
  queueEnabled = true;
  console.log('✅ Message queue enabled (Redis available)');
} catch (error) {
  console.warn('⚠️ Message queue disabled (Redis not available), using sync processing');
  queueEnabled = false;
}

/**
 * 添加消息處理任務到 queue
 * 如果 queue 不可用，直接執行處理邏輯
 */
export async function addMessageJob(job: MessageJob): Promise<void> {
  if (!queueEnabled) {
    // 降級：直接處理（非阻塞）
    processMessageJob(job).catch((err) => {
      console.error('Error processing message job (sync):', err);
    });
    return;
  }

  // 使用 Redis list 作為簡單 queue
  const queueKey = 'message:queue';
  await Cache.set(`${queueKey}:${Date.now()}:${job.messageId}`, job, 60); // TTL 60 秒
  
  // 觸發處理（非阻塞）
  processMessageJob(job).catch((err) => {
    console.error('Error processing message job:', err);
  });
}

/**
 * 處理消息任務
 */
async function processMessageJob(job: MessageJob): Promise<void> {
  const { messageId, roomId } = job;

  try {
    // 動態導入（避免循環依賴）
    const { prisma } = await import('./prisma');
    const { Cache } = await import('./redis-cache');

    // 1. 獲取消息
    const message = await (prisma as any).chatMessage.findUnique({
      where: { id: messageId },
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
      },
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // 2. 更新 room.lastMessageAt（非同步，不阻塞）
    (prisma as any).chatRoom
      .update({
        where: { id: roomId },
        data: { lastMessageAt: message.createdAt },
      })
      .catch((err: any) => {
        console.error('Failed to update lastMessageAt:', err);
      });

    // 3. 推送 socket（使用全局變量）
    try {
      // 從全局變量獲取 io（socket-server 會設置）
      const globalIo = (global as any).socketIO;
      if (globalIo) {
        // ✅ 關鍵：只發給該房間（room-based emit）
        globalIo.to(roomId).emit('message', message);
        console.log(`📤 Emitted message to room: ${roomId}`);
      } else {
        console.warn('Socket server not available, skipping socket emit');
      }
    } catch (err) {
      console.warn('Error emitting socket message:', err);
    }

    // 4. 清除 cache（使用統一的 cache key 格式）
    const cacheKey = `messages:${roomId}:latest:30`;
    await Cache.delete(cacheKey).catch(() => {});
    
    // 也清除其他可能的變體
    const cachePattern = `messages:${roomId}:*`;
    await Cache.deletePattern(cachePattern).catch(() => {});

    console.log(`✅ Processed message job: ${messageId}`);
  } catch (error) {
    console.error('Error processing message job:', error);
    throw error;
  }
}

export { processMessageJob };

