# 🔧 Socket 單例修復說明

## 🚨 問題

截圖顯示有 **6 個 socket.io 連接**，這是不對的。應該只有 **1 個**。

## 🔍 根本原因

1. **多個組件同時調用 `useChatSocket`**：
   - `app/chat/page.tsx` 調用了一次
   - `app/chat/[roomId]/page.tsx` 調用了一次
   - 如果兩個頁面同時存在，就會有 2 個 hook 實例

2. **事件監聽器重複綁定**：
   - 每個 hook 實例都會綁定事件監聽器
   - 即使 socket 是單例，事件監聽器也會重複綁定
   - 導致同一個事件被觸發多次

3. **useEffect 依賴導致重複執行**：
   - `useEffect` 依賴 `[enabled, session?.user?.id, roomId]`
   - 當這些值變化時，會重新執行，導致重複綁定

## ✅ 修復方案

### 1. 確保 Socket 真正是單例

```typescript
// 全局變數（模組級別）
let globalSocket: Socket | null = null;
let globalInitializedRef = false;

// 在創建 socket 之前立即標記
if (!globalSocket && !globalInitializedRef) {
  globalInitializedRef = true; // ✅ 立即標記
  globalSocket = io(socketUrl, {...});
}
```

### 2. 正確清理事件監聽器

```typescript
// 每個 hook 實例綁定自己的事件處理器
const handleConnect = () => { ... };
socket.on('connect', handleConnect);

// 清理時移除
return () => {
  socket.off('connect', handleConnect);
  // ...
};
```

### 3. 只在需要時啟用 Socket

```typescript
// app/chat/page.tsx
useChatSocket({ 
  roomId: selectedRoomId, 
  enabled: !!selectedRoomId && status === 'authenticated' // ✅ 只在需要時啟用
});
```

## 📊 驗證

### 檢查 Socket 連接數

1. 打開 Network → WS
2. 應該只有 **1 條** `socket.io/?EIO=4` 連接
3. 切換房間時不應該增加

### 檢查 Console 日誌

應該看到：
- `🚀 Creating SINGLE Socket connection (global singleton) - FIRST TIME ONLY`（只出現一次）
- `✅ Socket already initialized (global), reusing existing connection`（後續都看到這個）

不應該看到：
- 多個 "Creating SINGLE Socket connection" 日誌
- 多個 socket.io 連接

---

**修復已完成！請刷新頁面測試。** ✅

