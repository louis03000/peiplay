'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getGameIconPath, getGameEmoji, hasGameIcon } from '@/lib/game-icons'

interface GameIconProps {
  gameName: string
  size?: number | string // 可以是數字（px）或字串（如 '1rem', '16px'）
  className?: string
}

/**
 * 遊戲圖標組件
 * 自動處理圖片載入失敗的情況，回退到 emoji
 */
export default function GameIcon({ gameName, size = 16, className = '' }: GameIconProps) {
  const iconPath = getGameIconPath(gameName)
  const fallbackEmoji = getGameEmoji(gameName)
  const hasIcon = hasGameIcon(gameName)
  const [imageError, setImageError] = useState(false)
  
  // 如果沒有對應的圖標，直接顯示 emoji
  if (!hasIcon || !iconPath || imageError) {
    return (
      <span className={`inline-block ${className}`} style={{ fontSize: typeof size === 'number' ? `${size}px` : size }}>
        {fallbackEmoji}
      </span>
    )
  }
  
  // 將 size 轉換為數字（如果是字串，嘗試解析）
  const sizeNum = typeof size === 'number' 
    ? size 
    : parseInt(size.toString().replace(/[^\d]/g, '')) || 16
  
  return (
    <span className={`inline-block relative ${className}`} style={{ width: sizeNum, height: sizeNum }}>
      <Image
        src={iconPath}
        alt={gameName}
        width={sizeNum}
        height={sizeNum}
        className="object-contain"
        onError={() => {
          // 如果圖片載入失敗，設置錯誤狀態，組件會重新渲染顯示 emoji
          setImageError(true)
        }}
      />
    </span>
  )
}

