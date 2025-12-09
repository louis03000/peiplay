# Redis URL 格式說明

## ❌ 錯誤格式

```
https://redis-17714.c89.us-east-1-3.ec2.redns.redis-cloud.com:17714
```

這個格式缺少：
1. 協議前綴（應該是 `redis://` 或 `rediss://`）
2. 認證資訊（用戶名和密碼）

## ✅ 正確格式

Redis URL 的標準格式為：

```
redis://[username]:[password]@[host]:[port]
```

或使用 SSL：

```
rediss://[username]:[password]@[host]:[port]
```

## 🔧 Redis Cloud 連接字串格式

Redis Cloud 通常提供兩種格式：

### 格式 1：完整 URL（推薦）

```
redis://default:your-password@redis-17714.c89.us-east-1-3.ec2.redns.redis-cloud.com:17714
```

### 格式 2：分開設定

如果 Redis Cloud 提供分開的資訊：
- **Host**: `redis-17714.c89.us-east-1-3.ec2.redns.redis-cloud.com`
- **Port**: `17714`
- **Password**: `your-password`

組合成：
```
redis://default:your-password@redis-17714.c89.us-east-1-3.ec2.redns.redis-cloud.com:17714
```

## 📍 如何找到正確的連接字串

### Redis Cloud Dashboard

1. 登入 [Redis Cloud Console](https://redis.com/try-free/)
2. 選擇您的資料庫
3. 查看 **Connect** 或 **Configuration** 頁面
4. 複製 **Redis URL** 或 **Connection String**

通常會顯示類似：
```
redis://default:AbCdEf123456@redis-17714.c89.us-east-1-3.ec2.redns.redis-cloud.com:17714
```

## 🔐 安全提醒

1. **不要將密碼提交到 Git**
2. **只在 Vercel 環境變數中設定**
3. **使用 `rediss://`（SSL）更安全**（如果 Redis Cloud 支援）

## ✅ 驗證格式

設定後，可以透過測試 API 驗證：

訪問：`https://your-domain.vercel.app/api/test-redis`

如果格式正確，會看到：
```json
{
  "status": "connected",
  "message": "Redis is working correctly"
}
```

如果格式錯誤，會看到：
```json
{
  "status": "error",
  "message": "Invalid URL or connection failed"
}
```

