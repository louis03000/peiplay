'use client'

import { useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface PageLoaderProps {
  children: ReactNode
  fallback?: ReactNode
  delay?: number
}

// 頁面載入優化組件
export function PageLoader({ 
  children, 
  fallback = <DefaultLoader />, 
  delay = 0 
}: PageLoaderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 延遲顯示內容，避免閃爍
    const timer = setTimeout(() => {
      setIsLoading(false)
      // 使用 requestAnimationFrame 確保平滑過渡
      requestAnimationFrame(() => {
        setShowContent(true)
      })
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  // 監聽路由變化
  useEffect(() => {
    const handleRouteChange = () => {
      setIsLoading(true)
      setShowContent(false)
    }

    // 監聽路由變化
    const handleStart = () => handleRouteChange()
    const handleComplete = () => {
      setTimeout(() => {
        setIsLoading(false)
        setShowContent(true)
      }, 100)
    }

    // 這裡可以添加路由監聽邏輯
    return () => {
      // 清理監聽器
    }
  }, [])

  if (isLoading) {
    return <>{fallback}</>
  }

  return (
    <div className={`transition-opacity duration-300 ${
      showContent ? 'opacity-100' : 'opacity-0'
    }`}>
      {children}
    </div>
  )
}

// 預設載入器
function DefaultLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">載入中...</p>
      </div>
    </div>
  )
}

// 骨架屏載入器
export function SkeletonLoader({ 
  lines = 3, 
  className = "" 
}: { 
  lines?: number
  className?: string 
}) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`bg-gray-200 rounded ${
            index === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
          style={{ height: '20px', marginBottom: '8px' }}
        />
      ))}
    </div>
  )
}

// 漸顯載入器
export function FadeLoader({ 
  children, 
  delay = 100 
}: { 
  children: ReactNode
  delay?: number 
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={`transition-all duration-500 ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4'
      }`}
    >
      {children}
    </div>
  )
}

// 進度條載入器
export function ProgressLoader({ 
  progress = 0, 
  className = "" 
}: { 
  progress?: number
  className?: string 
}) {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}

// 智能載入器 - 根據內容類型選擇載入方式
export function SmartLoader({ 
  type = 'default',
  children,
  ...props 
}: {
  type?: 'default' | 'skeleton' | 'fade' | 'progress'
  children: ReactNode
  [key: string]: any
}) {
  switch (type) {
    case 'skeleton':
      return <SkeletonLoader {...props}>{children}</SkeletonLoader>
    case 'fade':
      return <FadeLoader {...props}>{children}</FadeLoader>
    case 'progress':
      return <ProgressLoader {...props}>{children}</ProgressLoader>
    default:
      return <PageLoader {...props}>{children}</PageLoader>
  }
}
