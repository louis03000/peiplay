'use client'

import { useEffect, useState, useRef } from 'react'

interface PerformanceMetrics {
  fps: number
  memoryUsage?: number
  renderTime: number
  timestamp: number
}

interface PerformanceMonitorProps {
  enabled?: boolean
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void
  threshold?: {
    fps?: number
    renderTime?: number
  }
}

export function PerformanceMonitor({ 
  enabled = false, 
  onMetricsUpdate,
  threshold = { fps: 30, renderTime: 16 }
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    renderTime: 0,
    timestamp: Date.now()
  })
  
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const animationId = useRef<number>()
  const renderStartTime = useRef(performance.now())

  useEffect(() => {
    if (!enabled) return

    const measurePerformance = () => {
      const now = performance.now()
      frameCount.current++

      // 每秒計算 FPS
      if (now - lastTime.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current))
        const renderTime = now - renderStartTime.current
        
        const newMetrics: PerformanceMetrics = {
          fps,
          renderTime,
          timestamp: Date.now()
        }

        // 獲取記憶體使用情況（如果可用）
        if ('memory' in performance) {
          const memory = (performance as any).memory
          newMetrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024 // MB
        }

        setMetrics(newMetrics)
        onMetricsUpdate?.(newMetrics)

        // 檢查性能警告
        if (fps < (threshold.fps || 30)) {
          console.warn(`性能警告: FPS 過低 (${fps})`)
        }
        if (renderTime > (threshold.renderTime || 16)) {
          console.warn(`性能警告: 渲染時間過長 (${renderTime.toFixed(2)}ms)`)
        }

        frameCount.current = 0
        lastTime.current = now
      }

      renderStartTime.current = performance.now()
      animationId.current = requestAnimationFrame(measurePerformance)
    }

    animationId.current = requestAnimationFrame(measurePerformance)

    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current)
      }
    }
  }, [enabled, onMetricsUpdate, threshold])

  if (!enabled) return null

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div>FPS: {metrics.fps}</div>
      <div>渲染: {metrics.renderTime.toFixed(1)}ms</div>
      {metrics.memoryUsage && (
        <div>記憶體: {metrics.memoryUsage.toFixed(1)}MB</div>
      )}
    </div>
  )
}

// 性能優化 Hook
export function usePerformanceOptimization() {
  const [isLowPerformance, setIsLowPerformance] = useState(false)
  const [recommendations, setRecommendations] = useState<string[]>([])

  const analyzePerformance = (metrics: PerformanceMetrics) => {
    const newRecommendations: string[] = []
    let lowPerformance = false

    if (metrics.fps < 30) {
      lowPerformance = true
      newRecommendations.push('FPS 過低，建議減少動畫效果或簡化 UI')
    }

    if (metrics.renderTime > 16) {
      lowPerformance = true
      newRecommendations.push('渲染時間過長，建議使用 React.memo 或 useMemo 優化')
    }

    if (metrics.memoryUsage && metrics.memoryUsage > 100) {
      lowPerformance = true
      newRecommendations.push('記憶體使用量過高，建議檢查記憶體洩漏')
    }

    setIsLowPerformance(lowPerformance)
    setRecommendations(newRecommendations)
  }

  return {
    isLowPerformance,
    recommendations,
    analyzePerformance
  }
}

// 組件渲染時間測量 Hook
export function useRenderTime() {
  const renderStartTime = useRef(performance.now())
  const [renderTime, setRenderTime] = useState(0)

  useEffect(() => {
    const endTime = performance.now()
    const time = endTime - renderStartTime.current
    setRenderTime(time)
    renderStartTime.current = performance.now()
  })

  return renderTime
}

// 網路請求性能監控
export function useNetworkPerformance() {
  const [requestTimes, setRequestTimes] = useState<Record<string, number>>({})
  const [slowRequests, setSlowRequests] = useState<string[]>([])

  const monitorRequest = (url: string, startTime: number) => {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    setRequestTimes(prev => ({ ...prev, [url]: duration }))
    
    if (duration > 1000) { // 超過 1 秒的請求
      setSlowRequests(prev => [...prev, `${url} (${duration.toFixed(0)}ms)`])
    }
  }

  return {
    requestTimes,
    slowRequests,
    monitorRequest
  }
} 