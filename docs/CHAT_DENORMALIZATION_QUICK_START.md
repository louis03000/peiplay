# 🚀 聊天室 <1 秒重構快速開始指南

## ⚠️ 必須執行的步驟（順序不能錯）

### STEP 1: 執行資料庫 Migration（必須）

```sql
-- 執行 prisma/migrations/add_chat_message_denormalized_fields.sql

-- 1. 添加字段
ALTER TABLE "ChatMessage" 
ADD COLUMN IF NOT EXISTS "senderName" TEXT,
ADD COLUMN IF NOT EXISTS "senderAvatarUrl" TEXT;

-- 2. 為現有數據填充字段
UPDATE "ChatMessage" cm
SET 
  "senderName" = COALESCE(u.name, u.email, '未知用戶'),
  "senderAvatarUrl" = p."coverImage"
FROM "User" u
LEFT JOIN "Partner" p ON p."userId" = u.id
WHERE cm."senderId" = u.id
  AND (cm."senderName" IS NULL OR cm."senderAvatarUrl" IS NULL);
```

### STEP 2: 重新生成 Prisma Client

```bash
npx prisma generate
```

### STEP 3: 重啟應用

```bash
# 重啟 Next.js 服務
npm run dev

# 重啟 Socket Server（如果有的話）
npm run socket:dev
```

## ✅ 驗證清單

### 1. 資料庫檢查

```sql
-- 檢查字段是否存在
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ChatMessage' 
  AND column_name IN ('senderName', 'senderAvatarUrl');

-- 應該返回：
-- senderName | text
-- senderAvatarUrl | text
```

### 2. API 測試

打開瀏覽器 Network tab，檢查：

- ✅ `/api/chat/rooms/[roomId]/messages`
  - 時間 < 200ms
  - 響應包含 `senderName` 和 `senderAvatarUrl`
  - 不包含 `sender` 對象的嵌套查詢

- ✅ `/api/chat/rooms`
  - 只返回有 `lastMessageAt` 的房間
  - 無重複的聊天室

### 3. 前端檢查

- ✅ 每條消息都顯示頭像
- ✅ 頭像使用 lazy loading
- ✅ 圖片載入不阻塞文字渲染
- ✅ 只顯示有消息記錄的聊天室

### 4. 效能檢查

- ✅ messages API < 150ms
- ✅ 聊天室載入 < 1 秒
- ✅ Network 中 messages 只出現 1 次

## 🔧 如果仍然慢

### 檢查 1: Migration 是否執行

```sql
-- 檢查字段是否存在
SELECT "senderName", "senderAvatarUrl" 
FROM "ChatMessage" 
LIMIT 1;

-- 如果返回 NULL，表示 migration 未執行
```

### 檢查 2: 索引是否正確

```sql
-- 檢查索引是否存在
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ChatMessage' 
  AND indexname LIKE '%roomId%createdAt%';

-- 應該返回：
-- ChatMessage_roomId_createdAt_idx | CREATE INDEX ... ON "ChatMessage"("roomId", "createdAt" DESC)
```

### 檢查 3: API 是否使用新字段

打開 Network tab，查看 messages API 的響應：

```json
{
  "messages": [
    {
      "id": "...",
      "senderName": "用戶名稱",      // ✅ 應該有這個
      "senderAvatarUrl": "https://...", // ✅ 應該有這個
      "sender": {
        "name": "用戶名稱",
        "avatarUrl": "https://..."
      }
    }
  ]
}
```

如果沒有 `senderName` 或 `senderAvatarUrl`，表示：
1. Migration 未執行
2. 或者 API 代碼還在使用舊的 JOIN 邏輯

## 📊 預期效能

| 操作 | 目標時間 | 驗證方法 |
|------|----------|----------|
| messages API | < 150ms | Network tab |
| 聊天室載入 | < 1 秒 | Network tab Finish |
| 發送訊息 | < 300ms | Network tab |

## 🚨 常見問題

### Q: Migration 執行失敗
**A**: 檢查資料庫連接，確保有足夠權限執行 ALTER TABLE

### Q: 現有消息沒有頭像
**A**: Migration 中的 UPDATE 會填充現有數據，如果沒有執行 migration 就不會有

### Q: 新消息仍然沒有頭像
**A**: 檢查發送消息的 API 是否正確寫入 `senderName` 和 `senderAvatarUrl`

### Q: 前端不顯示頭像
**A**: 
1. 檢查 API 響應是否包含 `senderAvatarUrl`
2. 檢查前端代碼是否正確讀取該字段
3. 檢查圖片 URL 是否有效

