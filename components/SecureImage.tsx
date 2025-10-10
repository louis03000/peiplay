'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'

interface SecureImageProps {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  onLoad?: () => void
  onError?: () => void
  sizes?: string
  priority?: boolean
  loading?: 'lazy' | 'eager'
}

export default function SecureImage({ 
  src, 
  alt, 
  fill = false,
  width,
  height,
  className = '',
  onLoad,
  onError,
  sizes,
  priority = false,
  loading = 'lazy'
}: SecureImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleLoad = useCallback(() => {
    setImageLoaded(true)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setImageError(true)
    onError?.()
  }, [onError])

  // 如果是錯誤狀態，顯示預設圖片
  if (imageError) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
        <div className="text-gray-500 text-sm">圖片無法載入</div>
      </div>
    )
  }

  // 使用安全代理 URL
  const secureSrc = `/api/secure-image?url=${encodeURIComponent(src)}`

  const imageProps = {
    src: secureSrc,
    alt,
    className: `${className} ${!imageLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`,
    onLoad: handleLoad,
    onError: handleError,
    sizes,
    priority,
    loading,
  }

  if (fill) {
    return (
      <Image
        {...imageProps}
        fill
      />
    )
  }

  return (
    <Image
      {...imageProps}
      width={width || 300}
      height={height || 300}
    />
  )
}
