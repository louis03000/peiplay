# 🚑 聊天室架構修復報告

## 問題診斷

### 🔴 核心問題
1. **Socket 連接重複建立**：每次 `roomId` 變化都會重新創建 Socket，導致：
   - 多個 Socket 連接同時存在
   - 重複訂閱事件
   - 資源浪費

2. **前端初始化失控**：
   - `useEffect` 依賴 `[rooms, selectedRoomId, session?.user?.id]` 導致重複執行
   - 每次 state 變化都會重新載入數據
   - API 被重複調用 6 次

3. **API 請求無去重機制**：
   - 同一房間的消息被重複請求
   - 沒有 AbortController 取消機制

## ✅ 修復方案

### 1️⃣ Socket 連接改為 Singleton

**修改前**：
```typescript
useEffect(() => {
  socketRef.current = io(...);
  // ...
}, [enabled, session?.user?.id, roomId]); // ❌ roomId 變化會重建 socket
```

**修改後**：
```typescript
// 全局 Socket 單例
let globalSocket: Socket | null = null;

useEffect(() => {
  if (initializedRef.current && globalSocket) {
    return; // 重用現有連接
  }
  globalSocket = io(...); // 只創建一次
}, [enabled, session?.user?.id]); // ✅ 移除 roomId 依賴

// 單獨處理 roomId 變化（只切換房間，不重建 socket）
useEffect(() => {
  if (roomId && globalSocket) {
    globalSocket.emit('room:join', { roomId });
  }
}, [roomId]);
```

**效果**：
- ✅ Socket 只連接 1 次
- ✅ 房間切換時只發送 `room:join`，不重建連接
- ✅ 大幅減少連接數和資源消耗

### 2️⃣ 前端初始化防重複機制

**修改前**：
```typescript
useEffect(() => {
  loadRooms();
}, [status, router]); // ❌ 依賴太多

useEffect(() => {
  loadMessages();
}, [selectedRoomId, session?.user?.id]); // ❌ session 變化會重載
```

**修改後**：
```typescript
const initializedRef = useRef(false);

useEffect(() => {
  if (initializedRef.current) return; // ✅ 防止重複初始化
  initializedRef.current = true;
  console.log('🚀 Chat initialized');
  loadRooms();
}, [status]); // ✅ 移除 router 依賴

useEffect(() => {
  loadMessages();
}, [selectedRoomId]); // ✅ 移除 session?.user?.id 依賴
```

**效果**：
- ✅ 初始化只執行 1 次
- ✅ API 調用次數大幅減少
- ✅ 避免不必要的重新載入

### 3️⃣ API 請求去重機制

**修改後**：
```typescript
const loadingMessagesRef = useRef<Map<string, AbortController>>(new Map());

useEffect(() => {
  // 取消進行中的請求
  const existingController = loadingMessagesRef.current.get(selectedRoomId);
  if (existingController) {
    existingController.abort();
  }

  const abortController = new AbortController();
  loadingMessagesRef.current.set(selectedRoomId, abortController);

  fetch(url, { signal: abortController.signal });
  
  return () => {
    abortController.abort();
  };
}, [selectedRoomId]);
```

**效果**：
- ✅ 同一房間的重複請求會被取消
- ✅ 避免請求重疊導致的數據混亂
- ✅ 提升性能和用戶體驗

### 4️⃣ Debug 日誌

添加關鍵日誌點：
- `🚀 Chat initialized` - 聊天初始化
- `✅ Socket connected` - Socket 連接成功
- `🏠 Room joined: {roomId}` - 加入房間
- `📥 Loading messages for room: {roomId}` - 載入消息
- `✅ Loaded {count} messages` - 載入完成
- `⚠️ Aborting duplicate request` - 取消重複請求

## 📊 預期改善

| 指標 | 修復前 | 修復後 | 改善 |
|------|--------|--------|------|
| Socket 連接數 | 6+ 個 | 1 個 | 83%↓ |
| `/api/chat/rooms` 調用 | 6 次 | 1 次 | 83%↓ |
| `/api/chat/rooms/[id]/messages` 調用 | 6+ 次 | 1 次 | 83%↓ |
| 初始化時間 | 36 秒 | < 2 秒 | 94%↓ |
| Network requests | 46+ | < 10 | 78%↓ |

## 🔍 驗證方法

打開瀏覽器 Network tab，檢查：

1. ✅ **Socket 連接**：應該只有 1 條 WebSocket 連接
2. ✅ **API 調用**：
   - `rooms` API 只出現 1 次
   - `messages?limit=30` 只出現 1 次（每個房間）
3. ✅ **Console 日誌**：
   - `🚀 Chat initialized` 只出現 1 次
   - `✅ Socket connected` 只出現 1 次
   - `🏠 Room joined` 只在切換房間時出現
4. ✅ **Finish 時間**：< 3 秒

## ⚠️ 注意事項

1. **Socket 單例是全局的**：如果多個頁面同時使用，會共享同一個連接
2. **房間切換**：切換房間時會自動離開舊房間並加入新房間
3. **消息過濾**：只接收當前房間的消息，避免跨房間消息混亂

## 📝 修改檔案

1. ✅ `lib/hooks/useChatSocket.ts` - Socket 單例化
2. ✅ `app/chat/page.tsx` - 初始化防重複 + API 去重

## 🚀 後續優化建議

1. **考慮使用 React Query**：更好的緩存和請求管理
2. **考慮使用 Context**：統一管理 Socket 狀態
3. **考慮消息緩存**：避免每次切換房間都重新載入

