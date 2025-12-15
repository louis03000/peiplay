# 🔧 Socket 連接失敗修復說明

## 🚨 問題

Console 顯示多個 "WebSocket connection to 'wss://socket.peiplay.com/socket.io/?EIO=4&transport=websocket' failed" 錯誤。

## 🔍 根本原因

1. **Socket 服務器不可用**：
   - `wss://socket.peiplay.com` 可能沒有運行
   - 或者 URL 配置錯誤

2. **自動重連導致多次嘗試**：
   - `reconnection: true` 會自動重試
   - `reconnectionAttempts: 5` 會嘗試 5 次
   - 每次失敗都會產生一個錯誤

3. **多個 hook 實例同時嘗試連接**：
   - 即使有單例保護，如果連接失敗，每個 hook 實例可能都會嘗試

## ✅ 修復方案

### 1. 禁用自動重連

```typescript
globalSocket = io(socketUrl, {
  reconnection: false, // ✅ 禁用自動重連
  timeout: 5000, // ✅ 快速失敗
  // ...
});
```

### 2. 連接失敗時禁用 Socket

```typescript
globalSocket.on('connect_error', (error: any) => {
  console.error('❌ Socket connection error:', error.message);
  // 禁用 socket，避免重複嘗試
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
    globalInitializedRef = false; // 允許下次手動重試
  }
});
```

### 3. 驗證 Socket URL

```typescript
// 驗證 URL 格式
try {
  new URL(socketUrl);
} catch (error) {
  console.error('❌ Invalid Socket.IO URL format:', socketUrl);
  return;
}
```

## 📊 預期效果

### 如果 Socket 服務器可用
- ✅ 應該看到：`✅ Socket connected (SINGLE connection for entire site)`
- ✅ 只有 1 條 WebSocket 連接

### 如果 Socket 服務器不可用
- ✅ 應該看到：`❌ Socket connection error: ...`
- ✅ 應該看到：`⚠️ Socket connection failed, real-time features disabled. This is OK if socket server is not available.`
- ✅ **不會**有多次重連嘗試
- ✅ **不會**有重複的錯誤日誌

## 🔧 配置 Socket URL

### 檢查環境變數

確保 `.env.local` 或 Vercel 環境變數中有：

```bash
NEXT_PUBLIC_SOCKET_URL=wss://socket.peiplay.com
```

### 如果沒有 Socket 服務器

如果暫時沒有 Socket 服務器，這是**正常的**：
- 聊天功能會降級為使用 HTTP API
- 不會有實時更新，但基本功能正常
- 不會有錯誤日誌（已修復）

---

**修復已完成！請刷新頁面測試。** ✅

