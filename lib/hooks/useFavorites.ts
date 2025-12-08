/**
 * Favorites 資料獲取 Hook
 * 使用 SWR 進行快取和優化
 */

import useSWR from 'swr'
import { authenticatedFetcher } from '@/lib/swr-config'

export function useFavorites() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/favorites',
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 60秒內不重複請求
      keepPreviousData: true,
    }
  )
  
  return {
    favorites: data?.favorites || [],
    isLoading,
    isError: error,
    mutate,
  }
}

