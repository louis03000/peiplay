# Peiplay 聊天系統實作完成

## ✅ 已完成功能

### 1. 資料庫 Schema
- ✅ 新增 `ChatRoom` 模型（支援一對一和群組）
- ✅ 新增 `ChatMessage` 模型（支援內容審查）
- ✅ 新增 `ChatRoomMember` 模型（管理聊天室成員）
- ✅ 新增 `MessageReadReceipt` 模型（已讀回條）

### 2. Socket.IO Server
- ✅ 獨立的 Socket.IO server（`socket-server/`）
- ✅ Redis message queue 支援（水平擴展）
- ✅ 即時訊息傳送
- ✅ Typing indicator
- ✅ Online status
- ✅ 已讀回條

### 3. 內容審查系統
- ✅ 關鍵字過濾（中文）
- ✅ OpenAI Moderation API 整合（可選）
- ✅ 自動標記可疑訊息
- ✅ 管理員審查介面

### 4. Next.js API Routes
- ✅ `/api/chat/rooms` - 獲取/創建聊天室
- ✅ `/api/chat/rooms/[roomId]` - 聊天室詳情
- ✅ `/api/chat/rooms/[roomId]/messages` - 訊息歷史
- ✅ `/api/chat/rooms/[roomId]/read` - 標記已讀
- ✅ `/api/admin/chat` - 管理員審查

### 5. 前端 UI
- ✅ 聊天室列表頁面 (`/chat`)
- ✅ 聊天室詳情頁面 (`/chat/[roomId]`)
- ✅ 管理員審查頁面 (`/admin/chat`)
- ✅ 整合到預約列表（「聊天」按鈕）

## 🚀 部署步驟

### 1. 安裝依賴

```bash
# 主專案
npm install

# Socket.IO server
npm run socket:install
```

### 2. 環境變數設定

#### 主專案 (.env)
```env
DATABASE_URL=your_postgresql_url
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_URL=http://localhost:3004

# OpenAI Moderation API (可選)
OPENAI_API_KEY=your_openai_api_key
```

#### Socket.IO Server (socket-server/.env)
```env
SOCKET_PORT=5000
NEXT_PUBLIC_URL=http://localhost:3004
REDIS_URL=redis://localhost:6379
DATABASE_URL=your_postgresql_url
OPENAI_API_KEY=your_openai_api_key  # 可選
```

### 3. 資料庫 Migration

```bash
# 注意：如果 migration 失敗，可能需要手動執行 SQL
npx prisma migrate dev --name add_chat_room_system

# 或手動執行 SQL（見下方）
```

### 4. 啟動服務

```bash
# 終端 1: Next.js 前端
npm run dev

# 終端 2: Socket.IO server
npm run socket:dev
```

## 📋 手動執行 Migration SQL

如果自動 migration 失敗，可以手動執行以下 SQL：

```sql
-- 創建 enum 類型
CREATE TYPE "ChatRoomType" AS ENUM ('ONE_ON_ONE', 'GROUP');
CREATE TYPE "MessageContentType" AS ENUM ('TEXT', 'IMAGE', 'SYSTEM');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- 創建 ChatRoom 表
CREATE TABLE "ChatRoom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" "ChatRoomType" NOT NULL DEFAULT 'ONE_ON_ONE',
  "bookingId" TEXT UNIQUE,
  "groupBookingId" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  CONSTRAINT "ChatRoom_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ChatRoom_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 創建 ChatRoomMember 表
CREATE TABLE "ChatRoomMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ChatRoomMember_roomId_userId_key" UNIQUE ("roomId", "userId"),
  CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 創建 ChatMessage 表
CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "contentType" "MessageContentType" NOT NULL DEFAULT 'TEXT',
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "moderationReason" TEXT,
  "moderationScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 創建 MessageReadReceipt 表
CREATE TABLE "MessageReadReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReadReceipt_messageId_userId_key" UNIQUE ("messageId", "userId"),
  CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 創建索引
CREATE INDEX "ChatRoom_bookingId_idx" ON "ChatRoom"("bookingId");
CREATE INDEX "ChatRoom_groupBookingId_idx" ON "ChatRoom"("groupBookingId");
CREATE INDEX "ChatRoom_lastMessageAt_idx" ON "ChatRoom"("lastMessageAt");
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");
CREATE INDEX "ChatRoomMember_roomId_idx" ON "ChatRoomMember"("roomId");
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");
CREATE INDEX "ChatMessage_moderationStatus_idx" ON "ChatMessage"("moderationStatus");
CREATE INDEX "ChatMessage_roomId_status_idx" ON "ChatMessage"("roomId", "status");
CREATE INDEX "MessageReadReceipt_userId_idx" ON "MessageReadReceipt"("userId");
CREATE INDEX "MessageReadReceipt_messageId_idx" ON "MessageReadReceipt"("messageId");
```

## 🔧 使用說明

### 用戶端

1. **進入聊天室**：
   - 在預約列表頁面，點擊「聊天」按鈕
   - 或直接訪問 `/chat` 查看所有聊天室

2. **發送訊息**：
   - 在聊天室頁面輸入訊息並點擊「發送」
   - 支援即時傳送和接收

3. **查看已讀狀態**：
   - 訊息旁會顯示 ✓✓ 表示已讀

### 管理員端

1. **審查訊息**：
   - 訪問 `/admin/chat`
   - 查看待審查、已標記、已拒絕的訊息
   - 可以批准或拒絕訊息

## 📝 內容審查規則

### 自動拒絕（REJECTED）
- 包含性交易相關關鍵字
- 包含 18 禁內容關鍵字
- 包含私底下接單關鍵字

### 自動標記（FLAGGED）
- 包含多個可疑關鍵字（如：現金、轉帳、見面等）
- OpenAI Moderation API 標記為可疑

### 待審查（PENDING）
- 新訊息預設狀態
- 等待審查或自動審查

## 🐛 故障排除

### Socket.IO 連接失敗
1. 確認 Socket.IO server 正在運行
2. 檢查 `NEXT_PUBLIC_SOCKET_URL` 環境變數
3. 確認 Redis 連接正常

### 無法創建聊天室
1. 確認用戶有權限（是訂單的客戶或陪玩）
2. 檢查資料庫連接
3. 查看後端日誌

### 訊息無法發送
1. 確認 Socket.IO 連接狀態
2. 檢查內容審查是否拒絕
3. 查看瀏覽器控制台錯誤

## 📚 相關檔案

- `prisma/schema.prisma` - 資料庫 schema
- `socket-server/` - Socket.IO server
- `app/api/chat/` - API routes
- `app/chat/` - 前端頁面
- `lib/hooks/useChatSocket.ts` - Socket.IO hook
- `socket-server/src/moderation.ts` - 內容審查邏輯

## 🎯 下一步（Discord 整合）

Discord Bot 整合將在下一階段實作，包括：
- 自動建立 Discord 語音房間
- 返回 invite URL
- 訂單結束時自動刪除房間

