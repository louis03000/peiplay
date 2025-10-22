'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'

// 自定義防抖函數
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 自定義節流函數
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let inThrottle: boolean = false
  let timeoutId: NodeJS.Timeout | null = null
  
  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      timeoutId = setTimeout(() => inThrottle = false, limit)
    }
  }
  
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    inThrottle = false
  }
  
  return throttled
}

// 性能監控 Hook
export function usePerformanceMonitor(componentName: string) {
  const [renderTime, setRenderTime] = useState(0)
  const [isSlow, setIsSlow] = useState(false)
  const startTime = useRef<number>(0)

  useEffect(() => {
    startTime.current = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime.current
      setRenderTime(duration)
      setIsSlow(duration > 16) // 超過一幀的時間
      
      if (duration > 16) {
        console.warn(`🐌 ${componentName} 渲染時間過長: ${duration.toFixed(2)}ms`)
      }
    }
  }, [componentName])

  return { renderTime, isSlow }
}

// 防抖 Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// 節流 Hook
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const throttledCallback = useMemo(
    () => throttle(callback, delay),
    [callback, delay]
  )

  useEffect(() => {
    return () => {
      throttledCallback.cancel()
    }
  }, [throttledCallback])

  return throttledCallback
}

// 優化的搜索輸入組件
interface OptimizedSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export const OptimizedSearchInput = memo(function OptimizedSearchInput({
  value,
  onChange,
  placeholder = "搜尋...",
  debounceMs = 300,
  className = ""
}: OptimizedSearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const debouncedOnChange = useDebounce(onChange, debounceMs)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    debouncedOnChange(newValue)
  }, [debouncedOnChange])

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    />
  )
})

// 優化的按鈕組件
interface OptimizedButtonProps {
  onClick: () => void | Promise<void>
  children: React.ReactNode
  disabled?: boolean
  loading?: boolean
  className?: string
  throttleMs?: number
}

export const OptimizedButton = memo(function OptimizedButton({
  onClick,
  children,
  disabled = false,
  loading = false,
  className = "",
  throttleMs = 1000
}: OptimizedButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const throttledOnClick = useThrottle(async () => {
    if (loading || isLoading) return
    
    setIsLoading(true)
    try {
      await onClick()
    } finally {
      setIsLoading(false)
    }
  }, throttleMs)

  return (
    <button
      onClick={throttledOnClick}
      disabled={disabled || loading || isLoading}
      className={`px-4 py-2 rounded-md transition-colors ${
        disabled || loading || isLoading
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${className}`}
    >
      {loading || isLoading ? '處理中...' : children}
    </button>
  )
})

// 虛擬化列表組件
interface VirtualizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  itemHeight: number
  containerHeight: number
  overscan?: number
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + overscan,
    items.length
  )

  const visibleItems = items.slice(visibleStart, visibleEnd)

  const handleScroll = useCallback(
    throttle((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop)
    }, 16),
    []
  )

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleStart * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={visibleStart + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleStart + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 圖片懶加載組件
interface LazyImageProps {
  src: string
  alt: string
  className?: string
  placeholder?: string
  width?: number
  height?: number
}

export function LazyImage({ 
  src, 
  alt, 
  className = "", 
  placeholder = "/images/placeholder.svg",
  width,
  height
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {isInView && (
        <img
          src={hasError ? placeholder : src}
          alt={alt}
          width={width}
          height={height}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />
      )}
      {!isInView && (
        <div 
          className="bg-gray-200 animate-pulse flex items-center justify-center"
          style={{ width, height }}
        >
          <div className="text-gray-400 text-sm">載入中...</div>
        </div>
      )}
    </div>
  )
}

// 骨架屏組件
interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  lines?: number
}

export function Skeleton({ 
  width = '100%', 
  height = '20px', 
  className = "",
  lines = 1
}: SkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="bg-gray-200 animate-pulse rounded"
          style={{ 
            width: index === lines - 1 ? '75%' : width, 
            height,
            marginBottom: index < lines - 1 ? '8px' : '0'
          }}
        />
      ))}
    </div>
  )
}

// 漸顯內容組件
interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function FadeIn({ 
  children, 
  delay = 0, 
  duration = 300,
  className = ""
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setIsVisible(true), delay)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-${duration} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}

// 性能優化的列表組件
interface OptimizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  loading?: boolean
  error?: string
  emptyMessage?: string
  className?: string
}

export function OptimizedList<T>({
  items,
  renderItem,
  keyExtractor,
  loading = false,
  error,
  emptyMessage = "沒有資料",
  className = ""
}: OptimizedListProps<T>) {
  if (loading) {
    return (
      <div className={className}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} height="60px" className="mb-4" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-500">載入失敗: {error}</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-500">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <FadeIn key={keyExtractor(item, index)} delay={index * 50}>
          {renderItem(item, index)}
        </FadeIn>
      ))}
    </div>
  )
}
}