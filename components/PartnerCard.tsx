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
}

interface PartnerCardProps {
  partner: Partner
  onQuickBook?: (partnerId: string) => void
  showNextStep?: boolean
  flipped?: boolean
}

export default function PartnerCard({ partner, onQuickBook, showNextStep = false, flipped = false }: PartnerCardProps) {
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

  // 個性化語句（可以根據夥伴資料動態生成）
  const getPersonalizedMessage = () => {
    const messages = [
      "我今天如果沒有打死你",
      "老子就不叫吉伊卡哇",
      "來吧，讓我們一起戰鬥！",
      "準備好接受挑戰了嗎？",
      "讓我們一起上分吧！"
    ]
    return messages[Math.abs(partner.name.length) % messages.length]
  }

  return (
    <div className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${
      flipped ? 'ring-4 ring-indigo-400 shadow-2xl' : 'hover:shadow-xl'
    }`}>
      {/* 上半部：白色背景，卡通角色區域 */}
      <div className="relative h-48 bg-white">
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
          <div className="w-full h-full flex items-center justify-center bg-white">
            {/* 默認卡通角色 */}
            <div className="relative">
              <div className="w-24 h-24 bg-white border-4 border-black rounded-full flex items-center justify-center">
                <div className="w-16 h-16 bg-white border-2 border-black rounded-full flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <div className="flex gap-1 mb-1">
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                      <div className="w-2 h-2 bg-black rounded-full"></div>
                    </div>
                    <div className="w-4 h-1 bg-black rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-2 bg-black rounded-full"></div>
            </div>
          </div>
        )}
        
        {/* 個性化語句 */}
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <p className="text-black text-sm font-medium">{getPersonalizedMessage()}</p>
        </div>
        
        {/* 狀態標籤 */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {partner.isAvailableNow && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
              <span className="text-yellow-200">⚡</span>
              <span className="hidden sm:inline">現在有空</span>
              <span className="sm:hidden">有空</span>
            </div>
          )}
          {partner.isRankBooster && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
              <span className="text-yellow-200">👑</span>
              <span className="hidden sm:inline">上分高手</span>
              <span className="sm:hidden">高手</span>
            </div>
          )}
        </div>

        {/* 多圖片導航 */}
        {partner.images && partner.images.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1">
            <button
              onClick={handlePrevImage}
              className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 transition-colors"
            >
              ‹
            </button>
            <button
              onClick={handleNextImage}
              className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 transition-colors"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* 下半部：深色背景區域 */}
      <div className="bg-gradient-to-b from-gray-800 via-gray-900 to-black p-4 text-white">
        {/* 夥伴姓名 */}
        <div className="mb-2">
          <h3 className="font-bold text-white text-lg">{partner.name}</h3>
        </div>

        {/* 遊戲標籤 */}
        <div className="flex flex-wrap gap-1 mb-2">
          {partner.games.slice(0, 1).map((game) => (
            <span
              key={game}
              className="inline-block bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-semibold"
            >
              {game}
            </span>
          ))}
        </div>

        {/* 個性化語句（在深色區域重複顯示） */}
        <div className="mb-2">
          <p className="text-white text-sm">{getPersonalizedMessage()}</p>
          <p className="text-white text-sm">老子就不叫吉伊卡哇</p>
        </div>

        {/* 價格資訊 */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-bold text-white">
            ${partner.halfHourlyRate}/半小時
          </div>
          
          {showNextStep && onQuickBook && (
            <button
              onClick={() => onQuickBook(partner.id)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm"
            >
              立即預約
            </button>
          )}
        </div>

        {/* 時段資訊 */}
        {partner.schedules && partner.schedules.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">可預約時段：</div>
            <div className="flex flex-wrap gap-1">
              {partner.schedules.slice(0, 2).map((schedule, index) => (
                <span
                  key={index}
                  className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                >
                  {new Date(schedule.date).toLocaleDateString()} {new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ))}
              {partner.schedules.length > 2 && (
                <span className="text-xs text-gray-500">+{partner.schedules.length - 2} 更多</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 