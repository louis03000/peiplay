# WebSocket 連接錯誤說明

## 🔍 錯誤訊息

```
WebSocket connection to 'wss://socket.peiplay.com/socket.io/?EIO=4&transport=websocket' failed
```

## ❓ 為什麼會出現這個錯誤？

這個錯誤出現是因為：

1. **環境變數已設定**：在 Vercel 環境變數中設定了 `NEXT_PUBLIC_SOCKET_URL=https://socket.peiplay.com`
2. **Socket 服務器未運行**：獨立的 Socket.IO 服務器（`socket-server/`）沒有部署或沒有運行
3. **前端嘗試連接**：前端代碼嘗試連接到這個 URL，但連接失敗

## ✅ 這會影響功能嗎？

**不會！** 系統已經實現了降級機制：

1. **自動降級**：如果 WebSocket 連接失敗，系統會自動使用 **polling（輪詢）** 作為後備方案
2. **功能正常**：聊天功能仍然可以正常工作，使用 API + polling 方式
3. **性能影響**：只是沒有即時推送，但訊息更新仍然很快（2-3秒輪詢一次）

## 🔧 解決方案

### 方案 1：移除環境變數（推薦，如果不需要即時功能）

如果您不需要 WebSocket 即時功能，可以移除環境變數：

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. Settings → Environment Variables
3. 找到 `NEXT_PUBLIC_SOCKET_URL`
4. 點擊右側的 **...** → **Delete**
5. 重新部署

這樣就不會有錯誤訊息了，系統會直接使用 polling。

### 方案 2：部署 Socket 服務器（如果需要即時功能）

如果您想要真正的即時聊天功能，需要部署 Socket.IO 服務器：

1. **部署 Socket 服務器**到獨立的主機（例如：Render、Railway、Fly.io）
2. **設定環境變數** `NEXT_PUBLIC_SOCKET_URL` 指向部署的 Socket 服務器
3. **配置 CORS** 允許您的 Vercel 域名連接

### 方案 3：改進錯誤處理（開發中）

我們可以在代碼中改進錯誤處理，讓它更安靜：

```typescript
// 如果連接失敗，靜默失敗，不顯示錯誤
globalSocket.on('connect_error', (error) => {
  console.warn('WebSocket connection failed, using polling fallback:', error.message);
  setIsConnected(false);
});
```

## 📊 目前狀態

- ✅ **聊天功能正常**：使用 API + polling
- ⚠️ **Console 有錯誤**：但不影響功能
- ✅ **性能已經優化**：Redis cache + 地區設定已解決速度問題

## 💡 建議

**目前建議：方案 1（移除環境變數）**

因為：
1. 您已經有 Redis cache，聊天室載入已經很快了
2. Polling 機制（2-3秒）對聊天室來說已經足夠快
3. 不需要額外維護 Socket 服務器
4. 可以避免 Console 錯誤訊息

等未來真正需要即時推送時，再考慮部署 Socket 服務器。








