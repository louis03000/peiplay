# Peiplay Socket.IO Server

獨立的 Socket.IO server，用於處理即時聊天功能。

## 功能

- ✅ 即時訊息傳送
- ✅ 聊天室管理（一對一和群組）
- ✅ 已讀回條
- ✅ Typing indicator
- ✅ Online status
- ✅ 內容審查（關鍵字過濾 + OpenAI Moderation API）
- ✅ Redis 水平擴展支援

## 安裝

```bash
npm install
```

## 環境變數

複製 `.env.example` 為 `.env` 並填入：

- `SOCKET_PORT`: Socket.IO server 端口（預設 5000）
- `NEXT_PUBLIC_URL`: Next.js 前端 URL
- `REDIS_URL`: Redis 連接 URL
- `DATABASE_URL`: PostgreSQL 資料庫 URL
- `OPENAI_API_KEY`: OpenAI API Key（可選，用於內容審查）

## 開發

```bash
npm run dev
```

## 生產環境

```bash
npm run build
npm start
```

## 部署

建議使用 PM2 或類似工具管理進程：

```bash
pm2 start dist/index.js --name peiplay-socket
```

