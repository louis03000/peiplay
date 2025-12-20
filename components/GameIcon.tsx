'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getGameIconPath, getGameEmoji, hasGameIcon, getGameIconPathWithFallback } from '@/lib/game-icons'

interface GameIconProps {
  gameName: string
  size?: number | string // 可以是數字（px）或字串（如 '1rem', '16px'）
  className?: string
}

/**
 * 遊戲圖標組件
 * 自動處理圖片載入失敗的情況，回退到 emoji
 * 支援多種副檔名和重複副檔名的情況
 */
export default function GameIcon({ gameName, size = 16, className = '' }: GameIconProps) {
  const fallbackEmoji = getGameEmoji(gameName)
  const hasIcon = hasGameIcon(gameName)
  const [imageError, setImageError] = useState(false)
  const [currentPathIndex, setCurrentPathIndex] = useState(0)
  
  // 獲取所有可能的圖片路徑
  const possiblePaths = hasIcon ? getGameIconPathWithFallback(gameName) : []
  const currentPath = possiblePaths[currentPathIndex] || getGameIconPath(gameName)
  
  // 如果沒有對應的圖標，直接顯示 emoji
  if (!hasIcon || !currentPath || imageError) {
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
  
  const handleImageError = () => {
    // 如果還有其他路徑可以嘗試，切換到下一個
    if (currentPathIndex < possiblePaths.length - 1) {
      setCurrentPathIndex(currentPathIndex + 1)
    } else {
      // 所有路徑都失敗了，顯示 emoji
      setImageError(true)
    }
  }
  
  return (
    <span className={`inline-block relative ${className}`} style={{ width: sizeNum, height: sizeNum }}>
      <Image
        src={currentPath}
        alt={gameName}
        width={sizeNum}
        height={sizeNum}
        className="object-contain"
        onError={handleImageError}
      />
    </span>
  )
}

