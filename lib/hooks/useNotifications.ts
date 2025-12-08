/**
 * Notifications 資料獲取 Hook
 * 使用 SWR 進行快取和優化
 */

import useSWR from 'swr'
import { authenticatedFetcher } from '@/lib/swr-config'

export function usePersonalNotifications() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/personal-notifications',
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30秒內不重複請求
      keepPreviousData: true,
      // 定期重新驗證（每5分鐘）
      refreshInterval: 300000,
    }
  )
  
  return {
    notifications: data?.notifications || [],
    isLoading,
    isError: error,
    mutate,
  }
}

