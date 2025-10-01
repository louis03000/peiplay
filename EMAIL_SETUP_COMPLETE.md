# 📧 完整 Email 系統設置指南

## 🎉 功能完成！

您的 PeiPlay 系統現在擁有完整的 Email 功能，包括：

### ✅ **已實現的功能**

#### **1. 應用程式內部信箱系統**
- 📧 用戶間私信功能
- 🔔 系統通知功能
- 📅 預約相關通知
- 👨‍💼 管理員廣播功能
- 📱 響應式信箱界面

#### **2. 真正的 Email 發送功能**
- 📨 自動發送 Email 到用戶郵箱
- 🎨 美觀的 HTML Email 模板
- 🔔 多種類型的通知 Email
- ⚙️ 用戶可自訂 Email 通知設定

#### **3. Email 通知類型**
- **訊息通知** - 新私信時發送 Email
- **預約通知** - 預約創建、確認、取消等
- **系統通知** - 系統公告、維護通知
- **密碼重設** - 安全的密碼重設 Email

## 🚀 **使用方式**

### **1. 設置 Email 配置**

在您的 `.env.local` 文件中添加：

```bash
# Email 配置 (Gmail SMTP)
EMAIL_USER="your-gmail@gmail.com"
EMAIL_APP_PASSWORD="your-16-digit-app-password"

# 系統 URL (用於 Email 中的連結)
NEXTAUTH_URL="http://localhost:3004"
```

### **2. 獲取 Gmail 應用程式密碼**

1. 登入您的 Gmail 帳號
2. 前往 [Google 帳戶設定](https://myaccount.google.com/)
3. 點擊「安全性」→「兩步驟驗證」
4. 啟用兩步驟驗證（如果尚未啟用）
5. 在「應用程式密碼」中生成新的密碼
6. 選擇「郵件」和「其他（自訂名稱）」
7. 輸入「PeiPlay 系統」作為名稱
8. 複製生成的 16 位元密碼

### **3. 測試 Email 功能**

#### **方法一：使用測試 API**
```bash
# 測試訊息 Email
curl -X POST http://localhost:3004/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com", "testType": "message"}'

# 測試通知 Email
curl -X POST http://localhost:3004/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com", "testType": "notification"}'

# 測試預約 Email
curl -X POST http://localhost:3004/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com", "testType": "booking"}'
```

#### **方法二：在系統中測試**
1. 登入系統
2. 前往「📧 信箱」
3. 撰寫新訊息
4. 發送給其他用戶
5. 檢查是否收到 Email 通知

### **4. 管理 Email 設定**

1. 登入系統
2. 點擊用戶頭像
3. 選擇「📧 Email 設定」
4. 調整您想要的 Email 通知類型

## 📱 **用戶界面**

### **信箱頁面** (`/messages`)
- 📧 查看所有訊息和通知
- ✍️ 撰寫新訊息
- 🔔 即時未讀數量顯示
- 📱 響應式設計

### **Email 設定頁面** (`/profile/email-settings`)
- ⚙️ 自訂 Email 通知偏好
- 🔄 即時保存設定
- 📋 清楚的設定說明

## 🎨 **Email 模板特色**

- **美觀設計** - 漸層背景和現代化 UI
- **響應式** - 支援各種設備查看
- **多語言** - 支援繁體中文
- **詳細資訊** - 包含完整的訊息和通知資訊
- **安全提醒** - 清楚的安全提示

## 🔧 **技術實現**

### **資料庫模型**
- `Message` - 內部訊息
- `Notification` - 系統通知
- 完整的關聯和索引

### **API 路由**
- `/api/messages` - 訊息 CRUD
- `/api/notifications` - 通知管理
- `/api/test-email` - Email 測試
- `/api/users` - 用戶列表

### **Email 服務**
- Gmail SMTP 整合
- HTML 模板系統
- 錯誤處理和重試機制
- 用戶偏好設定

## 🚀 **下一步建議**

### **進階功能**
1. **即時通知** - 集成 WebSocket 實現即時通知
2. **Email 模板編輯器** - 讓管理員自訂 Email 模板
3. **附件支持** - 支持發送圖片、文件等附件
4. **訊息搜索** - 添加訊息搜索功能
5. **批量操作** - 批量刪除、標記已讀等

### **整合功能**
1. **預約流程整合** - 在預約流程中自動發送相關通知
2. **Discord 整合** - 與 Discord 機器人整合
3. **手機推送** - 添加手機推送通知
4. **多語言支持** - 支持英文等其他語言

## 🎯 **測試清單**

- [ ] Gmail 應用程式密碼設置
- [ ] 環境變數配置
- [ ] 測試 Email 發送
- [ ] 信箱功能測試
- [ ] Email 設定測試
- [ ] 不同通知類型測試

## 📞 **支援**

如果遇到問題：
1. 檢查 Gmail 應用程式密碼是否正確
2. 確認環境變數是否設置
3. 查看控制台錯誤訊息
4. 使用測試 API 驗證 Email 功能

---

🎉 **恭喜！您的 PeiPlay 系統現在擁有完整的 Email 功能！**
