# 🔧 修復聊天系統載入失敗

## 問題原因
聊天系統的資料庫表尚未建立，導致 API 返回 500 錯誤。

## ✅ 解決方案（3 選 1）

### 方法 1：在 Supabase Dashboard 執行 SQL（推薦，最快）

1. **登入 Supabase Dashboard**
   - 前往 https://supabase.com/dashboard
   - 選擇您的專案

2. **打開 SQL Editor**
   - 左側選單 → SQL Editor
   - 點擊 "New query"

3. **執行 SQL**
   - 複製 `scripts/create_chat_tables.sql` 的全部內容
   - 貼到 SQL Editor
   - 點擊 "Run" 執行

4. **重新生成 Prisma Client**
   ```bash
   npx prisma generate
   ```

5. **重新部署**
   - 推送代碼到 GitHub
   - Vercel 會自動重新部署

### 方法 2：使用 Prisma Migration

```bash
# 1. 生成 migration 文件
npx prisma migrate dev --create-only --name add_chat_room_system

# 2. 查看生成的 SQL（在 prisma/migrations/ 目錄）
# 3. 手動在 Supabase 執行 SQL（因為自動 migration 可能失敗）

# 4. 標記 migration 為已應用
npx prisma migrate resolve --applied add_chat_room_system

# 5. 重新生成 Prisma Client
npx prisma generate
```

### 方法 3：臨時修復（已實作）

我已經添加了錯誤處理，如果模型不存在會返回空陣列而不是 500 錯誤。

**但這只是臨時方案**，聊天功能仍無法正常使用，直到執行 migration。

## 📋 驗證 Migration 是否成功

執行以下 SQL 檢查表是否存在：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ChatRoom', 'ChatRoomMember', 'ChatMessage', 'MessageReadReceipt');
```

應該看到 4 個表。

## 🚀 執行 Migration 後

1. 重新生成 Prisma Client：`npx prisma generate`
2. 重新部署應用
3. 測試聊天功能：
   - 訪問 `/chat` 應該不再顯示錯誤
   - 創建一個預約後，點擊「聊天」按鈕應該能進入聊天室

## ⚠️ 注意事項

- Migration 只需要執行一次
- 執行前請備份資料庫（如果擔心）
- 如果遇到錯誤，請檢查 SQL 語法或資料庫權限

