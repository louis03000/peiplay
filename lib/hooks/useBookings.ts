/**
 * Bookings 資料獲取 Hook
 * 使用 SWR 進行快取和優化
 * 
 * 注意：需要安裝 SWR: npm install swr
 */

// @ts-ignore - SWR 是可選依賴
import useSWR from 'swr'
// @ts-ignore
import { authenticatedFetcher } from '@/lib/swr-config'

export function useBookings(type: 'me' | 'partner' = 'me') {
  const url = type === 'me' ? '/api/bookings/me' : '/api/bookings/partner'
  
  const { data, error, isLoading, mutate } = useSWR(
    url,
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30秒內不重複請求
      keepPreviousData: true,
    }
  )
  
  return {
    bookings: data?.bookings || [],
    isLoading,
    isError: error,
    mutate,
  }
}

