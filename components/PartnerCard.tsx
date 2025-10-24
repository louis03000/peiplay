'use client'

import { useState, useCallback, memo, useMemo } from 'react'
import SecureImage from './SecureImage'
import { FaBolt, FaCrown, FaMedal, FaTrophy, FaComments, FaHeart, FaStar, FaQuoteLeft, FaQuoteRight } from 'react-icons/fa'

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
  averageRating?: number
  totalReviews?: number
}

interface PartnerCardProps {
  partner: Partner
  onQuickBook?: (partnerId: string) => void
  showNextStep?: boolean
  flipped?: boolean
  onFlip?: () => void
}

const PartnerCard = memo(function PartnerCard({ partner, onQuickBook, showNextStep = false, flipped = false, onFlip }: PartnerCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handleImageError = () => {
    setImageError(true)
  }

  const getGameIcon = (game: string) => {
    const gameIcons: { [key: string]: string } = {
      '英雄聯盟': '⚔️',
      '特戰英豪': '🎯',
      'Apex 英雄': '🚀',
      'CS:GO': '🔫',
      'PUBG': '🏃',
      'Valorant': '🎯',
      'LOL': '⚔️',
      'APEX': '🚀'
    }
    return gameIcons[game] || '🎮'
  }

  const handlePrevImage = useCallback(() => {
    if (partner.images && partner.images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + partner.images!.length) % partner.images!.length)
    }
  }, [partner.images])

  const handleNextImage = useCallback(() => {
    if (partner.images && partner.images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % partner.images!.length)
    }
  }, [partner.images])

  // 性能優化：使用 useMemo 緩存計算結果
  const availableSchedules = useMemo(() => {
    return partner.schedules?.filter(schedule => schedule.isAvailable) || []
  }, [partner.schedules])

  const handleFlip = useCallback(() => {
    if (onFlip) {
      onFlip()
    }
  }, [onFlip])

  return (
    <div 
      className={`relative w-full transition-all duration-700 transform ${
        flipped ? 'rotate-y-180' : ''
      }`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* 正面 */}
      <div className={`w-full ${flipped ? 'hidden' : 'block'}`}>
        <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
          {/* 圖片區域 */}
          <div className="relative h-48 overflow-hidden">
            {partner.images && partner.images.length > 0 ? (
              <SecureImage
                src={partner.images[currentImageIndex]}
                alt={partner.name}
                fill
                className="object-cover"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-lg">無圖片</span>
              </div>
            )}
            
            {/* 圖片切換按鈕 */}
            {partner.images && partner.images.length > 1 && (
              <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={handlePrevImage}
                  className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  ←
                </button>
                <button
                  onClick={handleNextImage}
                  className="bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  →
                </button>
              </div>
            )}

            {/* 狀態標籤 */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {partner.isAvailableNow && (
                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <FaBolt className="text-yellow-300" />
                  現在有空
                </span>
              )}
              {partner.isRankBooster && (
                <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <FaCrown className="text-yellow-300" />
                  上分高手
                </span>
              )}
            </div>

            {/* 評分 */}
            {partner.averageRating && partner.averageRating > 0 && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <FaStar className="text-yellow-400" />
                {partner.averageRating.toFixed(1)}
                {partner.totalReviews && ` (${partner.totalReviews})`}
              </div>
            )}
          </div>

          {/* 內容區域 */}
          <div className="p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{partner.name}</h3>
            
            {/* 遊戲標籤 */}
            <div className="flex flex-wrap gap-1 mb-3">
              {partner.games.slice(0, 3).map((game, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium"
                >
                  {getGameIcon(game)} {game}
                </span>
              ))}
              {partner.games.length > 3 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                  +{partner.games.length - 3}
                </span>
              )}
            </div>

            {/* 價格 */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-bold text-green-600">
                ${partner.halfHourlyRate}/30分鐘
              </span>
              {partner.isAvailableNow && (
                <span className="text-green-600 text-sm font-medium">即時預約</span>
              )}
            </div>

            {/* 客戶留言 */}
            {partner.customerMessage && (
              <div className="bg-gray-50 p-3 rounded-lg mb-3">
                <div className="flex items-start gap-2">
                  <FaQuoteLeft className="text-gray-400 text-sm mt-1" />
                  <p className="text-gray-700 text-sm italic">{partner.customerMessage}</p>
                  <FaQuoteRight className="text-gray-400 text-sm mt-1" />
                </div>
              </div>
            )}

            {/* 按鈕區域 */}
            <div className="flex gap-2">
              {partner.isAvailableNow && onQuickBook && (
                <button
                  onClick={() => onQuickBook(partner.id)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FaBolt />
                  立即預約
                </button>
              )}
              
              {onFlip && (
                <button
                  onClick={handleFlip}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FaComments />
                  查看詳情
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 背面 */}
      <div className={`w-full ${flipped ? 'block' : 'hidden'}`}>
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{partner.name} - 詳細資訊</h3>
              {onFlip && (
                <button
                  onClick={handleFlip}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 時段資訊 */}
            <div className="mb-4">
              <h4 className="font-semibold text-gray-700 mb-2">可用時段</h4>
              {availableSchedules.length > 0 ? (
                <div className="space-y-1">
                  {availableSchedules.slice(0, 3).map((schedule) => (
                    <div key={schedule.id} className="text-sm text-gray-600">
                      {new Date(schedule.startTime).toLocaleString('zh-TW')} - {new Date(schedule.endTime).toLocaleString('zh-TW')}
                    </div>
                  ))}
                  {availableSchedules.length > 3 && (
                    <div className="text-sm text-gray-500">
                      還有 {availableSchedules.length - 3} 個時段...
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暫無可用時段</p>
              )}
            </div>

            {/* 評分詳情 */}
            {partner.averageRating && partner.averageRating > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-700 mb-2">評分</h4>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar
                        key={star}
                        className={`text-sm ${
                          star <= Math.round(partner.averageRating!)
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {partner.averageRating.toFixed(1)} ({partner.totalReviews} 則評價)
                  </span>
                </div>
              </div>
            )}

            {/* 返回按鈕 */}
            <button
              onClick={handleFlip}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default PartnerCard