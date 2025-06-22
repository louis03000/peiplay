'use client'

import { useCallback, useRef, useEffect, useState } from 'react'

// 防抖 Hook
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    },
    [callback, delay]
  ) as T
}

// 節流 Hook
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef(0)
  const lastCallTimer = useRef<NodeJS.Timeout>()

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall.current >= delay) {
        callback(...args)
        lastCall.current = now
      } else {
        if (lastCallTimer.current) {
          clearTimeout(lastCallTimer.current)
        }
        lastCallTimer.current = setTimeout(() => {
          callback(...args)
          lastCall.current = Date.now()
        }, delay - (now - lastCall.current))
      }
    },
    [callback, delay]
  ) as T
}

// 優化的搜索輸入組件
interface OptimizedSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounceMs?: number
}

export function OptimizedSearchInput({
  value,
  onChange,
  placeholder = "搜尋...",
  className = "",
  debounceMs = 300
}: OptimizedSearchInputProps) {
  const [localValue, setLocalValue] = useState(value)
  
  const debouncedOnChange = useDebounce(onChange, debounceMs)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    debouncedOnChange(newValue)
  }, [debouncedOnChange])

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  )
}

// 優化的按鈕組件
interface OptimizedButtonProps {
  onClick: () => void | Promise<void>
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
  className?: string
  throttleMs?: number
}

export function OptimizedButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  className = "",
  throttleMs = 1000
}: OptimizedButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  
  const throttledOnClick = useThrottle(async () => {
    if (isProcessing || disabled || loading) return
    
    setIsProcessing(true)
    try {
      await onClick()
    } finally {
      setIsProcessing(false)
    }
  }, throttleMs)

  return (
    <button
      onClick={throttledOnClick}
      disabled={disabled || loading || isProcessing}
      className={className}
    >
      {loading || isProcessing ? '處理中...' : children}
    </button>
  )
}

// 虛擬化列表組件（用於大量數據渲染）
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

  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => 
            renderItem(item, startIndex + index)
          )}
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
}

export function LazyImage({ src, alt, className = "", placeholder = "/images/placeholder.svg" }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.current) {
            imgRef.current.src = src
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [src])

  return (
    <img
      ref={imgRef}
      alt={alt}
      className={className}
      src={hasError ? placeholder : (isLoaded ? src : placeholder)}
      onLoad={() => setIsLoaded(true)}
      onError={() => setHasError(true)}
      style={{ opacity: isLoaded ? 1 : 0.5, transition: 'opacity 0.3s' }}
    />
  )
} 