import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 檢查環境變數
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 環境變數未設定')
  throw new Error('DATABASE_URL 環境變數未設定')
}

// 解析 DATABASE_URL 並添加連接池參數（如果是 PostgreSQL）
function getDatabaseUrlWithPool(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  
  // 如果是 PostgreSQL 且沒有連接池參數，添加連接池配置
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    try {
      const url = new URL(dbUrl)
      
      // 檢測環境和資料庫類型
      const isSupabase = url.hostname.includes('supabase.co')
      const isVercel = process.env.VERCEL === '1'
      
      // 只在沒有這些參數時才添加
      if (!url.searchParams.has('connection_limit') && !url.searchParams.has('pool_timeout')) {
        // Vercel serverless 環境優化
        if (isVercel) {
          // Vercel 每個 function 最多保持 1-2 個連接
          // 使用更小的連線池以避免連線耗盡
          url.searchParams.set('connection_limit', isSupabase ? '2' : '3')
          // 大幅增加超時時間，避免連線建立失敗
          url.searchParams.set('pool_timeout', '60') // 60秒連線池超時
          url.searchParams.set('connect_timeout', '30') // 30秒連線建立超時
          url.searchParams.set('statement_timeout', '45000') // 45秒查詢超時（Vercel function 最多60秒）
        } else {
          // 一般環境配置 - 優化連接池以提高查詢速度
          url.searchParams.set('connection_limit', isSupabase ? '5' : '10')
          url.searchParams.set('pool_timeout', '30') // 減少連線池超時，加快連接獲取
          url.searchParams.set('connect_timeout', '15') // 減少連線建立超時，加快連接速度
          url.searchParams.set('statement_timeout', '30000') // 30秒查詢超時
          // 添加查詢優化參數
          url.searchParams.set('application_name', 'peiplay') // 應用名稱，方便監控
        }
        
        // 如果使用 Supabase，提示使用連接池 URL
        if (isSupabase && !url.hostname.includes('pooler')) {
          console.warn('⚠️ 建議使用 Supabase Pooler URL (*.pooler.supabase.co) 以提高穩定性')
          console.warn('   您可以在 Supabase Dashboard > Settings > Database > Connection Pooling 找到')
        }
      }
      
      return url.toString()
    } catch (error) {
      console.error('❌ DATABASE_URL 格式錯誤:', error)
      return dbUrl // 返回原始 URL，讓 Prisma 自己處理錯誤
    }
  }
  
  return dbUrl
}

// 創建 Prisma 客戶端，針對 Vercel serverless 環境優化
// 注意：連線池設定通過 DATABASE_URL 的 query parameters 設定
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn', 'info'] : ['error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: getDatabaseUrlWithPool(),
      },
    },
  })

// 在 serverless 環境中，每次都使用同一個實例（如果可用）
// 這樣可以重用連接池，提高性能
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  // 生產環境也使用單例模式，避免在 serverless 中創建過多連接
  globalForPrisma.prisma = prisma
}

// 確保連接已建立（僅在首次使用時）
let connectionPromise: Promise<void> | null = null;
export async function ensureConnection() {
  if (!connectionPromise) {
    connectionPromise = prisma.$connect().catch((error) => {
      // 如果已經連接，Prisma 會拋出錯誤，這是正常的，可以忽略
      if (error?.message?.includes('already connected')) {
        return;
      }
      // 其他錯誤需要重新拋出
      connectionPromise = null; // 重置，以便下次重試
      throw error;
    });
  }
  return connectionPromise;
}

// 優雅關閉處理
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
} 