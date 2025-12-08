# 📖 Sender JOIN 說明

## 什麼是 Sender JOIN？

在資料庫查詢中，**JOIN** 是指將兩個或多個表的資料合併在一起。

### 在 PersonalNotification 表中的情況

`PersonalNotification` 表有一個 `senderId` 欄位，指向 `User` 表的 `id`。當我們需要顯示發送者的名稱時，需要：

1. **查詢 PersonalNotification 表** - 獲取通知資料
2. **JOIN User 表** - 根據 `senderId` 查找發送者的名稱

這就是 **sender JOIN**。

## 為什麼移除 Sender JOIN 會變快？

### 移除前（有 JOIN）：
```typescript
select: {
  id: true,
  title: true,
  // ... 其他欄位
  sender: {
    select: {
      id: true,
      name: true,
    },
  },
}
```

**查詢過程：**
1. 查詢 PersonalNotification 表（例如：50 筆通知）
2. 對每筆通知，查詢 User 表獲取發送者名稱（50 次額外查詢）
3. 合併結果

**時間：** 約 5-6 秒

### 移除後（無 JOIN）：
```typescript
select: {
  id: true,
  title: true,
  // ... 其他欄位
  // 沒有 sender JOIN
}
```

**查詢過程：**
1. 只查詢 PersonalNotification 表（50 筆通知）
2. 不需要查詢 User 表

**時間：** 約 0.5-1 秒

## 為什麼要恢復 Sender JOIN？

### 前端需要顯示發送者名稱

在 `components/PersonalNotificationPanel.tsx` 中，第 235 行：

```tsx
<span className="text-gray-400">來自: {notification.sender.name}</span>
```

前端會顯示「來自: 管理員張三」這樣的資訊。如果沒有 sender JOIN，所有通知都會顯示「來自: 系統」，用戶無法知道是誰發送的通知。

## 優化方案

### 方案 1：保留 Sender JOIN，但優化（推薦）

**優點：**
- ✅ 顯示真實的發送者名稱
- ✅ 只查詢 `name` 欄位，不查詢 `id` 和其他欄位
- ✅ 速度比完整 JOIN 快，但比無 JOIN 稍慢

**代碼：**
```typescript
sender: {
  select: {
    name: true, // 只查詢 name，減少資料傳輸
  },
}
```

**預期時間：** 約 1-1.5 秒

### 方案 2：移除 Sender JOIN

**優點：**
- ✅ 最快的速度（約 0.5-1 秒）

**缺點：**
- ❌ 所有通知顯示「來自: 系統」
- ❌ 用戶無法知道真實發送者

**代碼：**
```typescript
// 不查詢 sender
// 在返回時添加預設值
sender: {
  id: '',
  name: '系統',
}
```

### 方案 3：批量查詢 Sender（進階）

**優點：**
- ✅ 顯示真實的發送者名稱
- ✅ 比 JOIN 快（只查詢一次 User 表）

**缺點：**
- ❌ 代碼較複雜
- ❌ 需要兩次查詢

**代碼：**
```typescript
// 1. 先查詢通知（不 JOIN sender）
const notifications = await client.personalNotification.findMany({
  where: { userId: session.user.id },
  select: {
    id: true,
    senderId: true, // 獲取 senderId
    // ... 其他欄位
  },
});

// 2. 批量查詢所有發送者
const senderIds = [...new Set(notifications.map(n => n.senderId))];
const senders = await client.user.findMany({
  where: { id: { in: senderIds } },
  select: { id: true, name: true },
});

// 3. 在應用層合併資料
const senderMap = new Map(senders.map(s => [s.id, s]));
const formatted = notifications.map(n => ({
  ...n,
  sender: {
    id: n.senderId,
    name: senderMap.get(n.senderId)?.name || '系統',
  },
}));
```

## 當前實現

我們選擇了**方案 1**：保留 Sender JOIN，但只查詢 `name` 欄位。

這樣可以：
- ✅ 顯示真實的發送者名稱
- ✅ 保持較快的速度（約 1-1.5 秒）
- ✅ 代碼簡單易懂

## 如果還是太慢怎麼辦？

如果 1-1.5 秒還是太慢，可以考慮：

1. **使用方案 3（批量查詢）** - 可能更快
2. **添加緩存** - 發送者名稱不常變化，可以緩存
3. **減少查詢數量** - 從 50 筆減少到 30 筆

## 總結

- **Sender JOIN** = 查詢時從 User 表獲取發送者名稱
- **移除 JOIN** = 速度快，但所有通知顯示「來自: 系統」
- **保留 JOIN** = 速度稍慢，但顯示真實發送者名稱
- **當前方案** = 保留 JOIN，但只查詢 name 欄位，平衡速度和功能

