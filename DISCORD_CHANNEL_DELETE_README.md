# Discord 頻道自動刪除功能

## 🎯 **功能概述**

當預約被取消時，Discord bot 會自動刪除相關的文字頻道和語音頻道，保持伺服器整潔。

## 🚀 **實現的功能**

### **1. 資料庫修改**
- 在 `Booking` 模型中添加了 `discordTextChannelId` 和 `discordVoiceChannelId` 欄位
- 用於存儲 Discord 頻道的 ID

### **2. Discord Bot 修改**
- **創建頻道時：** 自動保存頻道 ID 到資料庫
- **刪除頻道時：** 提供 `/delete` 端點來處理頻道刪除請求
- **自動清理：** 刪除頻道後清除資料庫中的頻道 ID

### **3. API 整合**
- 修改了取消預約 API (`/api/bookings/[id]/cancel`)
- 取消預約成功後自動調用 Discord bot 刪除頻道

## 📋 **工作流程**

```
1. 用戶取消預約
   ↓
2. 更新預約狀態為 CANCELLED
   ↓
3. 調用 Discord bot 的 /delete 端點
   ↓
4. Discord bot 查詢資料庫獲取頻道 ID
   ↓
5. 刪除對應的文字頻道和語音頻道
   ↓
6. 清除資料庫中的頻道 ID
   ↓
7. 發送通知到管理員頻道
```

## 🔧 **技術實現**

### **Discord Bot 端點**
```python
@app.route('/delete', methods=['POST'])
def delete_booking():
    """刪除預約相關的 Discord 頻道"""
    # 接收預約 ID
    # 調用 delete_booking_channels 函數
    # 返回刪除結果
```

### **頻道刪除函數**
```python
async def delete_booking_channels(booking_id: str):
    """刪除預約相關的 Discord 頻道"""
    # 1. 從資料庫獲取頻道 ID
    # 2. 刪除文字頻道
    # 3. 刪除語音頻道
    # 4. 清除資料庫中的頻道 ID
    # 5. 發送管理員通知
```

### **API 整合**
```typescript
// 在取消預約成功後
await fetch('http://localhost:5001/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ booking_id: bookingId })
});
```

## 🧪 **測試方法**

### **1. 啟動 Discord Bot**
```bash
cd discord-bot
python bot.py
```

### **2. 測試頻道刪除**
```bash
python test_discord_delete.py
```

### **3. 測試完整流程**
1. 創建一個預約
2. 確認 Discord 頻道已創建
3. 取消預約
4. 確認 Discord 頻道已被刪除

## ⚠️ **注意事項**

1. **Discord Bot 必須運行：** 頻道刪除功能需要 Discord bot 在線
2. **資料庫欄位：** 需要先更新資料庫 schema
3. **權限檢查：** 確保 Discord bot 有刪除頻道的權限
4. **錯誤處理：** 即使頻道刪除失敗，預約取消操作仍會成功

## 🔍 **故障排除**

### **常見問題**

1. **無法連接到 Discord bot**
   - 檢查 bot 是否正在運行
   - 確認端口 5001 是否開放

2. **頻道刪除失敗**
   - 檢查 bot 權限
   - 確認頻道 ID 是否正確

3. **資料庫錯誤**
   - 檢查資料庫連接
   - 確認 schema 是否已更新

### **日誌檢查**
- Discord bot 控制台會顯示詳細的日誌
- 檢查是否有錯誤訊息

## 🎉 **完成狀態**

- ✅ 資料庫 schema 修改
- ✅ Discord bot 頻道刪除功能
- ✅ API 整合
- ✅ 錯誤處理
- ✅ 管理員通知
- ✅ 測試腳本

## 🚀 **下一步**

1. 部署到生產環境
2. 監控頻道刪除的成功率
3. 根據使用情況優化功能
4. 添加更多自動化功能
