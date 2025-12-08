/**
 * Partners 資料獲取 Hook
 * 使用 SWR 進行快取和優化
 * 
 * 注意：需要安裝 SWR: npm install swr
 */

// @ts-ignore - SWR 是可選依賴
import useSWR from 'swr'
// @ts-ignore
import { authenticatedFetcher } from '@/lib/swr-config'

interface PartnersParams {
  startDate?: string
  endDate?: string
  availableNow?: boolean
  rankBooster?: boolean
  game?: string
}

export function usePartners(params: PartnersParams = {}) {
  const { startDate, endDate, availableNow, rankBooster, game } = params
  
  // 建立查詢字串
  const searchParams = new URLSearchParams()
  if (startDate) searchParams.set('startDate', startDate)
  if (endDate) searchParams.set('endDate', endDate)
  if (availableNow) searchParams.set('availableNow', 'true')
  if (rankBooster) searchParams.set('rankBooster', 'true')
  if (game) searchParams.set('game', game)
  
  const url = `/api/partners${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  
  const { data, error, isLoading, mutate } = useSWR(
    url,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 60秒內不重複請求
      keepPreviousData: true,
    }
  )
  
  return {
    partners: data || [],
    isLoading,
    isError: error,
    mutate, // 手動重新驗證
  }
}

