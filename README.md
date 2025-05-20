# PeiPlay - 寵物美容預約平台

PeiPlay 是一個現代化的寵物美容預約平台，提供多語言支援、安全的用戶認證和便捷的預約管理功能。

## 功能特點

- 🌐 多語言支援（繁體中文、簡體中文、英文）
- 🔐 安全的用戶認證系統
  - 密碼加密存儲
  - 兩步驗證 (2FA)
  - 防暴力破解機制
- 📅 便捷的預約管理
  - 即時預約狀態更新
  - 預約提醒
  - 評價系統
- 👥 用戶角色管理
  - 客戶
  - 美容師
  - 管理員
- 📱 響應式設計
- 🔍 搜尋功能
- ⭐ 評價系統

## 技術棧

- Next.js 14
- TypeScript
- Prisma
- NextAuth.js
- Tailwind CSS
- PostgreSQL
- Docker

## 開始使用

1. 克隆專案：
   ```bash
   git clone https://github.com/yourusername/peiplay.git
   cd peiplay
   ```

2. 安裝依賴：
   ```bash
   npm install
   ```

3. 設置環境變數：
   ```bash
   cp .env.example .env
   ```
   編輯 `.env` 文件，填入必要的配置信息。

4. 初始化數據庫：
   ```bash
   npx prisma migrate dev
   ```

5. 啟動開發服務器：
   ```bash
   npm run dev
   ```

## 環境變數

- `DATABASE_URL`: PostgreSQL 數據庫連接 URL
- `NEXTAUTH_SECRET`: NextAuth.js 密鑰
- `NEXTAUTH_URL`: 應用程序 URL
- `SMTP_HOST`: SMTP 服務器主機
- `SMTP_PORT`: SMTP 服務器端口
- `SMTP_USER`: SMTP 用戶名
- `SMTP_PASSWORD`: SMTP 密碼

## 部署

1. 構建應用：
   ```bash
   npm run build
   ```

2. 啟動生產服務器：
   ```bash
   npm start
   ```

## 貢獻

歡迎提交 Pull Request 或創建 Issue。

## 授權

MIT License
