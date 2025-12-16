# Session 優化建議

## 問題

如果當前 session 存儲在資料庫中（例如 PostgreSQL session store），每次 API 請求都需要查詢資料庫來驗證 session，這會增加延遲，特別是在輪詢頻繁的場景下。

## 解決方案

### 方案 1：遷移到 Redis Session Store（推薦）

**優點：**
- 查詢速度極快（< 1ms）
- 適合高頻輪詢場景
- 支援 TTL 自動過期

**實作：**

```typescript
// lib/session-redis.ts
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import session from 'express-session';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

await redisClient.connect();

export const sessionStore = new RedisStore({
  client: redisClient,
  prefix: 'session:',
});

export const sessionConfig = {
  store: sessionStore,
  secret: process.env.NEXTAUTH_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
  },
};
```

**環境變數：**
```env
REDIS_URL=redis://localhost:6379
```

### 方案 2：使用 JWT Cookie（最輕量）

**優點：**
- 無需查詢資料庫或 Redis
- 完全無狀態
- 適合 serverless 環境

**實作：**

```typescript
// lib/auth-jwt.ts
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.NEXTAUTH_SECRET!;

export function createSessionToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: '30d' });
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get('session-token')?.value;
  if (!token) return null;
  
  const decoded = verifySessionToken(token);
  return decoded?.userId || null;
}
```

### 方案 3：Cache Session Lookup（折衷方案）

如果無法遷移 session store，可以快取 session 查詢結果：

```typescript
// lib/session-cache.ts
import { Cache } from '@/lib/redis-cache';

export async function getCachedSession(sessionId: string) {
  const cacheKey = `session:${sessionId}`;
  
  // 先查快取
  const cached = await Cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // 查資料庫
  const session = await db.session.findUnique({
    where: { id: sessionId },
  });
  
  // 存入快取（TTL: 5 分鐘）
  if (session) {
    await Cache.set(cacheKey, session, 300);
  }
  
  return session;
}
```

## 效能比較

| 方案 | 查詢時間 | 適用場景 |
|------|---------|---------|
| DB Session Store | 10-50ms | 低頻請求 |
| Redis Session Store | < 1ms | 高頻輪詢 |
| JWT Cookie | 0ms | Serverless |
| Cached DB Lookup | 1-5ms | 折衷方案 |

## 建議

對於預聊系統這種高頻輪詢場景，建議：

1. **短期（立即）：** 使用方案 3（Cache Session Lookup）
2. **中期（一週內）：** 遷移到方案 1（Redis Session Store）
3. **長期（可選）：** 考慮方案 2（JWT Cookie）以完全無狀態化

## 實作優先順序

1. ✅ 先完成 meta endpoint 和前端優化（已做）
2. ⏭️ 添加 Redis meta 快取（已做）
3. ⏭️ 優化 session lookup（可選，但建議）

## 相關文件

- [Redis 設定指南](../README.md)
- [效能優化詳情](./PRE_CHAT_OPTIMIZATION.md)

