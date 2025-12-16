# 預聊系統（Pre-Chat System）實作說明

## 概述

這是一個極簡、高效的預聊系統，專為陪玩平台設計。系統遵循以下設計原則：

1. **不做真正聊天室** - 僅支援預聊功能
2. **不支援歷史長查詢** - 只保留最新 10 則訊息
3. **不支援即時狀態** - 使用輪詢而非 WebSocket
4. **資料活不超過 24 小時** - 自動過期清理
5. **一個房間最多 10 則訊息** - 達到上限後鎖定

## 資料庫結構

### 資料表

#### `pre_chat_rooms`
- `id` (UUID) - 主鍵
- `user_id` (UUID) - 用戶 ID
- `partner_id` (UUID) - 陪玩師 ID
- `status` (TEXT) - 狀態：'open' | 'locked' | 'expired'
- `message_count` (SMALLINT) - 訊息數量（避免 COUNT 查詢）
- `expires_at` (TIMESTAMPTZ) - 過期時間（建立時間 + 24 小時）
- `created_at` (TIMESTAMPTZ) - 建立時間
- UNIQUE (user_id, partner_id) - 防止重複房間

#### `pre_chat_messages`
- `id` (BIGSERIAL) - 主鍵
- `room_id` (UUID) - 房間 ID（外鍵，CASCADE 刪除）
- `sender_type` (TEXT) - 發送者類型：'user' | 'partner'
- `content` (TEXT) - 訊息內容
- `created_at` (TIMESTAMPTZ) - 建立時間

### 索引

```sql
-- pre_chat_rooms 索引
CREATE INDEX idx_pre_chat_rooms_user ON pre_chat_rooms (user_id);
CREATE INDEX idx_pre_chat_rooms_partner ON pre_chat_rooms (partner_id);
CREATE INDEX idx_pre_chat_rooms_expires ON pre_chat_rooms (expires_at);
CREATE INDEX idx_pre_chat_rooms_status ON pre_chat_rooms (status);

-- pre_chat_messages 索引
CREATE INDEX idx_pre_chat_messages_room_time ON pre_chat_messages (room_id, created_at DESC);
```

## API 路由

### GET /api/chatrooms?partnerId={partnerId}

建立或取得聊天室。

**請求參數：**
- `partnerId` (query) - 陪玩師 ID

**回應：**
```json
{
  "chatId": "uuid",
  "isClosed": false,
  "createdAt": "2023-01-01T12:00:00Z",
  "expiresAt": "2023-01-02T12:00:00Z",
  "messageCount": 3,
  "status": "open",
  "messages": [
    {
      "id": "123",
      "senderId": "user-id",
      "senderType": "user",
      "content": "Hello",
      "createdAt": "2023-01-01T12:05:00Z"
    }
  ]
}
```

### GET /api/chatrooms/{chatId}/messages?since={timestamp}

查詢訊息。

**請求參數：**
- `chatId` (path) - 聊天室 ID
- `since` (query, 可選) - 時間戳，查詢此時間之後的訊息

**回應：**
```json
{
  "messages": [
    {
      "id": "123",
      "senderId": "user-id",
      "senderType": "user",
      "content": "Hello",
      "createdAt": "2023-01-01T12:05:00Z"
    }
  ]
}
```

### POST /api/chatrooms/{chatId}/messages

發送訊息。

**請求體：**
```json
{
  "content": "訊息內容"
}
```

**回應：**
```json
{
  "messageId": "123",
  "createdAt": "2023-01-01T12:05:00Z"
}
```

**錯誤處理：**
- 400: 訊息內容為空、含有禁止的聯絡資訊、已達上限、聊天室已關閉

## 訊息過濾

系統會自動過濾以下類型的聯絡資訊：

- URL（http://, https://, www.）
- Email 地址
- 社群帳號（@username, instagram, line, telegram 等）
- 電話號碼

使用正則表達式進行過濾，含有上述內容的訊息會被拒絕。

## 前端實作

### 頁面路由

- `/pre-chat/[chatId]` - 預聊頁面

### 輪詢機制

前端使用長輪詢（long polling）機制：

1. **初始載入**：載入最新 10 則訊息
2. **輪詢新訊息**：每 3 秒查詢一次新訊息（使用 `since` 參數）
3. **可見性優化**：頁面隱藏時暫停輪詢，顯示時恢復
4. **自動滾動**：新訊息到達時自動滾動到底部

### 使用範例

```typescript
// 從 PartnerCard 組件啟動預聊
const handleChatClick = async () => {
  const response = await fetch(`/api/chatrooms?partnerId=${partnerId}`);
  const data = await response.json();
  window.location.href = `/pre-chat/${data.chatId}?partnerId=${partnerId}`;
};
```

## 自動過期清理

### 方案 A：GitHub Actions（推薦，完全免費）

使用 GitHub Actions 定時執行清理任務，完全免費且穩定。

#### 設定步驟

1. **在 GitHub 設定 Secrets**
   - 前往 Repository → Settings → Secrets and variables → Actions
   - 添加以下 secrets：
     - `CRON_SECRET`：用於驗證的隨機字串（例如：`openssl rand -hex 32`）
     - `API_URL`：你的 API 網址（例如：`https://your-domain.com`）

2. **Workflow 文件已建立**
   - 文件位置：`.github/workflows/cleanup-pre-chat.yml`
   - 預設每小時執行一次（UTC 時間）

3. **環境變數設定**
   - 在 Vercel 或其他部署平台設定 `CRON_SECRET` 環境變數
   - 值需與 GitHub Secrets 中的 `CRON_SECRET` 相同

#### 手動觸發

你也可以在 GitHub Actions 頁面手動觸發清理任務：
- 前往 Repository → Actions → Cleanup Pre Chat → Run workflow

### 方案 B：Vercel Cron

如果使用 Vercel，可以在 `vercel.json` 中設定：

```json
{
  "crons": [{
    "path": "/api/cron/cleanup-pre-chat",
    "schedule": "0 * * * *"
  }]
}
```

### API 端點

- **內部 API**：`POST /api/internal/cleanup-pre-chat`（專為外部 cron 設計）
- **Cron API**：`POST /api/cron/cleanup-pre-chat`（Vercel Cron 使用）

**請求頭：**
```
Authorization: Bearer {CRON_SECRET}
```

**回應：**
```json
{
  "success": true,
  "deleted": 5,
  "timestamp": "2023-01-01T12:00:00Z"
}
```

**清理邏輯：**
```sql
DELETE FROM pre_chat_rooms WHERE expires_at < now();
-- ON DELETE CASCADE 會自動清理相關訊息
```

## 效能優化

### 資料庫層面

1. **避免 COUNT 查詢**：使用 `message_count` 欄位直接計數
2. **索引優化**：所有常用查詢都有對應索引
3. **事務鎖定**：發送訊息時使用 `FOR UPDATE` 避免併發問題
4. **限制查詢**：永遠只查詢最新 10 則訊息

### API 層面

1. **事務處理**：發送訊息使用事務確保一致性
2. **直接更新計數**：使用 `increment` 而非重新計算
3. **自動鎖定**：達到 10 則訊息時自動鎖定房間

### 前端層面

1. **長輪詢**：減少不必要的請求
2. **可見性檢查**：背景頁面暫停輪詢
3. **樂觀更新**：發送訊息立即顯示，不等待回應

## 遷移步驟

1. **執行資料庫 Migration**
   ```bash
   # 在 Supabase Dashboard 執行
   # prisma/migrations/create_pre_chat_system.sql
   ```

2. **更新 Prisma Schema**
   ```bash
   npx prisma generate
   ```

3. **設定自動清理**
   - **推薦**：使用 GitHub Actions（見 [GitHub Actions 設定指南](./GITHUB_ACTIONS_SETUP.md)）
   - **替代方案**：使用 Vercel Cron 或其他平台設定每小時執行 `/api/cron/cleanup-pre-chat`

4. **更新前端連結**
   - 將所有聊天按鈕指向新的預聊系統

## 注意事項

1. **不支援的功能**（刻意不實作）：
   - 已讀/未讀狀態
   - 在線狀態
   - 訊息搜尋
   - 圖片/檔案傳送
   - 表情貼圖
   - WebSocket 即時通訊

2. **限制**：
   - 每個房間最多 10 則訊息
   - 房間有效期 24 小時
   - 每個用戶與陪玩師只能有一個活躍房間

3. **安全性**：
   - 所有 API 都需要登入驗證
   - 訊息內容過濾聯絡資訊
   - 權限檢查確保只能存取自己的房間

## 故障排除

### 房間不存在
- 檢查是否已過期（24 小時）
- 檢查是否已達訊息上限（10 則）

### 無法發送訊息
- 檢查房間狀態是否為 'open'
- 檢查訊息數量是否已達上限
- 檢查訊息內容是否含有禁止的聯絡資訊

### 輪詢不工作
- 檢查頁面是否隱藏（document.hidden）
- 檢查房間是否已關閉
- 檢查網路連線

