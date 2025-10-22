# 🔧 資料庫連接問題診斷與解決指南

## 🚨 **常見問題與解決方案**

### 1. **連接池耗盡 (Connection Pool Exhausted)**

#### 症狀：
- 間歇性連接失敗
- 錯誤信息：`connection pool exhausted`
- 特定時間段無法連接

#### 原因：
- 同時連接數超過資料庫限制
- 連接未正確關閉
- 免費層級連接數限制

#### 解決方案：
```typescript
// 1. 優化連接池配置
const prisma = new PrismaClient({
  __internal: {
    engine: {
      pool: {
        max: 5,        // 減少最大連接數
        min: 1,        // 最小連接數
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 60000,
      },
    },
  },
})

// 2. 確保連接正確關閉
try {
  const result = await prisma.user.findMany()
  return result
} finally {
  await prisma.$disconnect()
}
```

### 2. **連接超時 (Connection Timeout)**

#### 症狀：
- 長時間無響應
- 錯誤信息：`connection timeout`
- 特定操作卡住

#### 原因：
- 網路延遲
- 資料庫負載高
- 查詢過於複雜

#### 解決方案：
```typescript
// 1. 增加連接超時時間
const prisma = new PrismaClient({
  __internal: {
    engine: {
      connectTimeout: 60000, // 60秒
      pool: {
        acquireTimeoutMillis: 30000,
      },
    },
  },
})

// 2. 使用連接池
const dbManager = DatabaseConnectionManager.getInstance()
const prisma = await dbManager.getConnection()
```

### 3. **環境變數問題**

#### 症狀：
- 完全無法連接
- 錯誤信息：`DATABASE_URL is not defined`
- 本地正常，部署失敗

#### 解決方案：
```bash
# 1. 檢查 Vercel 環境變數
# 前往 Vercel Dashboard > Project Settings > Environment Variables

# 2. 設定正確的 DATABASE_URL
DATABASE_URL="postgresql://username:password@host:port/database"

# 3. 檢查 Supabase 連接字串
# 前往 Supabase Dashboard > Settings > Database > Connection string
```

### 4. **Supabase 服務限制**

#### 症狀：
- 特定時間段連接失敗
- 錯誤信息：`too many connections`
- 免費層級限制

#### 解決方案：
```typescript
// 1. 使用連接池
const databaseUrl = process.env.DATABASE_URL
if (databaseUrl.includes('supabase')) {
  // 使用 Supabase 連接池
  const poolerUrl = databaseUrl.replace('db.', 'pooler.')
  process.env.DATABASE_URL = poolerUrl
}

// 2. 實施重試機制
async function connectWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$connect()
      return true
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## 🛠️ **診斷工具**

### 1. **健康檢查 API**
```bash
# 檢查資料庫健康狀態
GET /api/database/health

# 回應範例
{
  "success": true,
  "health": {
    "isConnected": true,
    "connectionCount": 3,
    "lastConnectionTime": "2024-01-01T00:00:00.000Z",
    "retryCount": 0
  },
  "performance": {
    "totalResponseTime": 150,
    "queryTime": 50,
    "userCount": 100,
    "performanceGrade": "A"
  }
}
```

### 2. **問題診斷 API**
```bash
# 診斷資料庫問題
GET /api/database/diagnose

# 回應範例
{
  "success": true,
  "diagnosis": {
    "overall": "warning",
    "issues": [
      {
        "type": "warning",
        "message": "連接數較高: 8",
        "impact": "可能導致連接池耗盡"
      }
    ],
    "solutions": [
      {
        "priority": "medium",
        "action": "優化連接池配置",
        "details": "減少同時連接數或增加連接池大小"
      }
    ]
  }
}
```

### 3. **性能測試 API**
```bash
# 執行性能測試
POST /api/database/health
{
  "testType": "stress"
}

# 回應範例
{
  "success": true,
  "testType": "stress",
  "results": {
    "tests": [
      {
        "name": "並發查詢 (5個)",
        "time": 250,
        "status": "good"
      }
    ]
  }
}
```

## 🔍 **監控與預防**

### 1. **實時監控**
```typescript
// 監控連接狀態
setInterval(async () => {
  const health = await checkDatabaseHealth()
  if (!health.isConnected) {
    console.error('❌ 資料庫連接中斷')
    // 發送警報
  }
}, 30000) // 每30秒檢查一次
```

### 2. **性能指標**
- **連接時間**: < 1秒 (優秀)
- **查詢時間**: < 100ms (優秀)
- **連接數**: < 5 (安全)
- **重試次數**: < 3 (穩定)

### 3. **警報設定**
```typescript
// 設定性能警報
const alerts = {
  connectionTime: 2000,    // 2秒
  queryTime: 1000,         // 1秒
  connectionCount: 8,      // 8個連接
  retryCount: 3            // 3次重試
}
```

## 🚀 **最佳實踐**

### 1. **連接管理**
```typescript
// 使用連接管理器
import { getDatabaseConnection } from '@/lib/db-connection'

export async function GET() {
  const prisma = await getDatabaseConnection()
  try {
    const users = await prisma.user.findMany()
    return NextResponse.json(users)
  } catch (error) {
    console.error('查詢失敗:', error)
    throw error
  }
}
```

### 2. **錯誤處理**
```typescript
// 優雅的錯誤處理
export async function GET() {
  try {
    const prisma = await getDatabaseConnection()
    const result = await prisma.user.findMany()
    return NextResponse.json(result)
  } catch (error) {
    if (error.code === 'P1001') {
      return NextResponse.json(
        { error: '資料庫連接失敗，請稍後再試' },
        { status: 503 }
      )
    }
    throw error
  }
}
```

### 3. **快取策略**
```typescript
// 實施查詢快取
const cache = new Map()

export async function GET() {
  const cacheKey = 'users'
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey))
  }
  
  const users = await prisma.user.findMany()
  cache.set(cacheKey, users)
  
  // 5分鐘後清除快取
  setTimeout(() => cache.delete(cacheKey), 300000)
  
  return NextResponse.json(users)
}
```

## 📊 **Supabase 特定優化**

### 1. **連接池配置**
```typescript
// 使用 Supabase 連接池
const databaseUrl = process.env.DATABASE_URL
if (databaseUrl.includes('supabase')) {
  // 替換為連接池 URL
  const poolerUrl = databaseUrl.replace('db.', 'pooler.')
  process.env.DATABASE_URL = poolerUrl
}
```

### 2. **地區優化**
```typescript
// 選擇最近的 Supabase 地區
const regions = {
  'asia': 'ap-southeast-1',
  'europe': 'eu-west-1',
  'america': 'us-east-1'
}

// 根據用戶位置選擇地區
const userRegion = getUserRegion() // 你的邏輯
const region = regions[userRegion] || 'ap-southeast-1'
```

### 3. **免費層級限制**
```typescript
// 監控免費層級限制
const FREE_TIER_LIMITS = {
  maxConnections: 60,
  maxRequests: 500000,
  maxStorage: 500 // MB
}

// 檢查是否接近限制
if (connectionCount > FREE_TIER_LIMITS.maxConnections * 0.8) {
  console.warn('⚠️ 接近連接數限制')
}
```

## 🆘 **緊急處理**

### 1. **連接中斷**
```bash
# 1. 檢查 Supabase 狀態
# 前往 https://status.supabase.com

# 2. 重啟應用
# 在 Vercel Dashboard 中重新部署

# 3. 檢查環境變數
# 確認 DATABASE_URL 是否正確
```

### 2. **性能問題**
```bash
# 1. 檢查連接數
GET /api/database/health

# 2. 診斷問題
GET /api/database/diagnose

# 3. 優化配置
# 根據診斷結果調整連接池設定
```

### 3. **升級方案**
```typescript
// 考慮升級 Supabase 方案
const upgradeBenefits = {
  'Pro': {
    maxConnections: 200,
    maxRequests: 2000000,
    maxStorage: 8000 // MB
  },
  'Team': {
    maxConnections: 500,
    maxRequests: 10000000,
    maxStorage: 50000 // MB
  }
}
```

## 📞 **需要手動處理的部分**

### 1. **Vercel 環境變數**
- 檢查 `DATABASE_URL` 是否正確設定
- 確認 `NEXTAUTH_SECRET` 已設定
- 檢查其他必要的環境變數

### 2. **Supabase 設定**
- 檢查 Supabase 專案狀態
- 確認資料庫連接設定
- 考慮升級方案以獲得更多連接

### 3. **監控設定**
- 設定性能監控警報
- 配置錯誤追蹤
- 建立性能報告

## ✅ **檢查清單**

- [ ] DATABASE_URL 環境變數正確設定
- [ ] 使用連接池管理連接
- [ ] 實施重試機制
- [ ] 監控連接狀態
- [ ] 優化查詢性能
- [ ] 設定適當的快取策略
- [ ] 考慮升級 Supabase 方案
- [ ] 建立監控和警報系統
