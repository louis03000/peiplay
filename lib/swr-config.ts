/**
 * SWR 配置
 * 用於優化前端資料獲取和快取
 */

// SWR 配置類型（如果未安裝 SWR，先註解掉）
// import { SWRConfiguration } from 'swr'

// 臨時類型定義（安裝 SWR 後可移除）
type SWRConfiguration = {
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  revalidateIfStale?: boolean
  dedupingInterval?: number
  shouldRetryOnError?: boolean
  errorRetryCount?: number
  errorRetryInterval?: number
  keepPreviousData?: boolean
  loadingTimeout?: number
  refreshInterval?: number
  fetcher?: (url: string) => Promise<any>
}

// 預設 SWR 配置
export const swrConfig: SWRConfiguration = {
  // 重新驗證策略
  revalidateOnFocus: false, // 視窗聚焦時不重新驗證
  revalidateOnReconnect: true, // 網路重連時重新驗證
  revalidateIfStale: true, // 資料過期時重新驗證
  
  // 去重策略
  dedupingInterval: 60000, // 60秒內相同請求只發送一次
  
  // 錯誤重試
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  
  // 快取策略
  keepPreviousData: true, // 保留舊資料直到新資料載入完成
  
  // 載入超時
  loadingTimeout: 10000, // 10秒超時
}

// 快取時間配置（秒）
export const CACHE_TIMES = {
  // 不常變動的資料
  STATIC: 3600, // 1小時
  
  // 較常變動的資料
  DYNAMIC: 300, // 5分鐘
  
  // 即時資料
  REALTIME: 30, // 30秒
  
  // 用戶資料
  USER: 600, // 10分鐘
  
  // 列表資料
  LIST: 180, // 3分鐘
}

// 自訂 fetcher
export const fetcher = async (url: string) => {
  const res = await fetch(url, {
    cache: 'no-store', // 不使用 Next.js 快取，使用 SWR 快取
  })
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // @ts-ignore
    error.info = await res.json()
    // @ts-ignore
    error.status = res.status
    throw error
  }
  
  return res.json()
}

// 帶認證的 fetcher
export const authenticatedFetcher = async (url: string) => {
  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'include', // 包含 cookies
  })
  
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // @ts-ignore
    error.info = await res.json()
    // @ts-ignore
    error.status = res.status
    throw error
  }
  
  return res.json()
}

