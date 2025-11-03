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

  // 處理空或無效的 src
  if (!src || src.trim() === '' || src === '/default-avatar.png') {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-purple-400 to-blue-400 ${className}`}>
        <span className="text-white font-bold text-lg">{alt?.charAt(0)?.toUpperCase() || '?'}</span>
      </div>
    )
  }

  // 如果是錯誤狀態，顯示預設佔位符
  if (imageError) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-purple-400 to-blue-400 ${className}`}>
        <span className="text-white font-bold text-lg">{alt?.charAt(0)?.toUpperCase() || '?'}</span>
      </div>
    )
  }

  // 檢查是否為 Cloudinary 圖片，直接使用（已在 next.config.js 中配置允許的域名）
  const isCloudinaryImage = src.includes('res.cloudinary.com')
  // 如果是 Cloudinary 圖片，直接使用；否則通過安全代理
  const secureSrc = isCloudinaryImage ? src : `/api/secure-image?url=${encodeURIComponent(src)}`

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
