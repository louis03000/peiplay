'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { FaBolt, FaCrown, FaMedal, FaTrophy } from 'react-icons/fa'

interface Partner {
  id: string
  name: string
  games: string[]
  halfHourlyRate: number
  coverImage?: string
  images?: string[]
  schedules: { id: string; date: string; startTime: string; endTime: string, isAvailable: boolean }[]
  isAvailableNow: boolean
  isRankBooster: boolean
  customerMessage?: string
}

interface PartnerCardProps {
  partner: Partner
  onQuickBook?: (partnerId: string) => void
  showNextStep?: boolean
  flipped?: boolean
  onFlip?: () => void
}

export default function PartnerCard({ partner, onQuickBook, showNextStep = false, flipped = false, onFlip }: PartnerCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  const handleNextImage = useCallback(() => {
    if (partner.images && partner.images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % partner.images!.length)
    }
  }, [partner.images])

  const handlePrevImage = useCallback(() => {
    if (partner.images && partner.images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + partner.images!.length) % partner.images!.length)
    }
  }, [partner.images])

  const currentImage = partner.images && partner.images.length > 0 
    ? partner.images[currentImageIndex] 
    : partner.coverImage

  const handleCardClick = useCallback(() => {
    console.log('Card clicked for partner:', partner.name, 'flipped:', flipped)
    if (onFlip) {
      onFlip()
    }
  }, [partner.name, flipped, onFlip])

  return (
    <div 
      className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 border border-gray-200 cursor-pointer ${
        flipped ? 'ring-4 ring-indigo-400 shadow-2xl' : 'hover:shadow-xl'
      }`}
      onClick={handleCardClick}
    >
      {/* 完整封面圖片區域 - 增加高度 */}
      <div className="relative h-64 bg-white">
        {currentImage && !imageError ? (
          <Image
            src={currentImage}
            alt={partner.name}
            fill
            className={`object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-indigo-100">
            {/* 默認卡通角色 */}
            <div className="relative">
              <div className="w-24 h-24 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-20 h-20 bg-white border border-gray-300 rounded-full flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <div className="flex gap-1 mb-1">
                      <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                      <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    </div>
                    <div className="w-4 h-0.5 bg-gray-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 狀態標籤 */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {partner.isAvailableNow && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-sm">
              <span className="text-xs">⚡ 現在有空</span>
            </div>
          )}
          {partner.isRankBooster && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full shadow-sm">
              <span className="text-xs">👑 上分高手</span>
            </div>
          )}
        </div>

        {/* 多圖片導航 */}
        {partner.images && partner.images.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 transition-colors"
            >
              ‹
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 transition-colors"
            >
              ›
            </button>
          </div>
        )}

        {/* 資訊直接覆蓋在圖片上 - 完全透明背景 */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* 夥伴姓名 */}
          <div className="mb-2">
            <h3 className="font-bold text-white text-lg drop-shadow-lg">{partner.name}</h3>
          </div>

          {/* 遊戲標籤 - 每個遊戲獨立小方格 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {partner.games.slice(0, 3).map((game) => (
              <span
                key={game}
                className="inline-block bg-purple-400 text-white px-2 py-1 rounded text-xs font-medium shadow-sm"
              >
                {game}
              </span>
            ))}
            {partner.games.length > 3 && (
              <span className="inline-block bg-purple-400 text-white px-2 py-1 rounded text-xs font-medium shadow-sm">
                +{partner.games.length - 3}
              </span>
            )}
          </div>

          {/* 價格資訊和按鈕 */}
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-white drop-shadow-lg">
              ${partner.halfHourlyRate}/半小時
            </div>
            
            {showNextStep && onQuickBook && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickBook(partner.id);
                }}
                className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-xs shadow-sm"
              >
                下一步
              </button>
            )}
          </div>

          {/* 留言板內容（翻面後顯示） */}
          {flipped && partner.customerMessage && (
            <div className="mt-3 pt-3 border-t border-white/30">
              <div className="text-xs text-white/90 mb-2 drop-shadow-lg">留言板：</div>
              <div className="text-sm text-white bg-black/60 backdrop-blur-sm p-3 rounded-lg border border-white/20 shadow-lg">
                {partner.customerMessage}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 