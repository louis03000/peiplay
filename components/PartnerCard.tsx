'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { FaBolt, FaCrown, FaMedal, FaTrophy, FaComments, FaHeart, FaStar } from 'react-icons/fa'

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

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFlip) {
      onFlip();
    }
  }, [onFlip]);

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-500 border border-gray-200 cursor-pointer transform ${
        flipped ? 'ring-4 ring-indigo-400 shadow-2xl scale-105' : 'hover:shadow-xl hover:scale-102'
      }`}
      onClick={handleCardClick}
    >
      {/* 卡片正反面內容 */}
      {!flipped ? (
        <div className="relative h-64 bg-white">
          {/* 封面圖片與資訊（正面） */}
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
          <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
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
                className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 transition-colors pointer-events-auto"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70 transition-colors pointer-events-auto"
              >
                ›
              </button>
            </div>
          )}

          {/* 往下漸層變黑效果 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent h-32 pointer-events-none"></div>
          
          {/* 資訊直接覆蓋在圖片上 - 完全透明背景 */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
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
              <div className="text-sky-300 font-semibold drop-shadow-lg">
                ${partner.halfHourlyRate}/半小時
              </div>
              {showNextStep && onQuickBook && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickBook(partner.id);
                  }}
                  className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-xs shadow-sm pointer-events-auto"
                >
                  下一步
                </button>
              )}
            </div>

            {/* 留言板內容不顯示在正面 */}
          </div>
        </div>
      ) : (
        <div className="relative h-64 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col justify-center items-center overflow-hidden">
          {/* 背景裝飾元素 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-4 w-8 h-8 border-2 border-white/30 rounded-full"></div>
            <div className="absolute top-8 right-8 w-4 h-4 bg-white/20 rounded-full"></div>
            <div className="absolute bottom-6 left-8 w-6 h-6 border border-white/20 rounded-full"></div>
            <div className="absolute bottom-4 right-4 w-3 h-3 bg-white/30 rounded-full"></div>
          </div>
          
          {/* 留言板內容（僅翻面時顯示） */}
          {partner.customerMessage ? (
            <div className="w-full px-6 relative z-10">
              {/* 標題區域 */}
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                  <FaComments className="text-white/80 text-sm" />
                  <span className="text-white/90 text-sm font-medium">留言板</span>
                </div>
              </div>
              
              {/* 主要留言內容 */}
              <div className="relative">
                {/* 裝飾性引號 */}
                <div className="absolute -top-2 -left-2 text-white/20 text-2xl">"</div>
                <div className="absolute -bottom-2 -right-2 text-white/20 text-2xl">"</div>
                
                {/* 留言卡片 */}
                <div className="bg-white/15 backdrop-blur-md p-4 rounded-xl border border-white/25 shadow-2xl relative overflow-hidden">
                  {/* 漸層背景效果 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5"></div>
                  
                  {/* 內容 */}
                  <div className="relative z-10">
                    <p className="text-white text-sm leading-relaxed font-medium">
                      {partner.customerMessage}
                    </p>
                  </div>
                  
                  {/* 底部裝飾 */}
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <FaHeart className="text-pink-300 text-xs" />
                    <FaStar className="text-yellow-300 text-xs" />
                  </div>
                </div>
              </div>
              
              {/* 底部提示 */}
              <div className="text-center mt-3">
                <p className="text-white/60 text-xs">點擊卡片返回正面</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-4">
                <FaComments className="text-white/40 text-4xl mx-auto mb-2" />
                <p className="text-white/60 text-sm">暫無留言</p>
              </div>
              <div className="text-center">
                <p className="text-white/40 text-xs">點擊卡片返回正面</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 