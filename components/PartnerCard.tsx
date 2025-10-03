'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
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
    // 移除 e.preventDefault() 和 e.stopPropagation()，讓事件可以冒泡
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

            {/* 遊戲標籤 - 移到右側，避免擋住卡通角色 */}
            <div className="flex flex-wrap gap-2 mb-2 justify-end">
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

            {/* 平均星等顯示 */}
            {partner.averageRating !== undefined && partner.averageRating > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={`text-xs ${
                        star <= Math.round(partner.averageRating!)
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-white/80 text-xs font-medium drop-shadow-lg">
                  {partner.averageRating.toFixed(1)}
                  {partner.totalReviews && ` (${partner.totalReviews}評價)`}
                </span>
              </div>
            )}

            {/* 留言板內容不顯示在正面 */}
          </div>
        </div>
      ) : (
        <div className="relative h-64 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col justify-center items-center overflow-hidden">
          {/* 高級背景裝飾 */}
          <div className="absolute inset-0">
            {/* 網格背景 */}
            <div className="absolute inset-0 opacity-5">
              <div className="w-full h-full" style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px),
                                radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                backgroundSize: '20px 20px'
              }}></div>
            </div>
            
            {/* 光暈效果 */}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-pink-500/20 rounded-full blur-2xl"></div>
            
            {/* 裝飾性線條 */}
            <div className="absolute top-8 left-8 w-16 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
            <div className="absolute bottom-8 right-8 w-16 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
          </div>
          
          {/* 留言板內容 */}
          {partner.customerMessage ? (
            <div className="w-full px-6 relative z-10">
              {/* 標題區域 */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 shadow-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <FaComments className="text-white text-sm" />
                  </div>
                  <span className="text-white/90 text-sm font-semibold tracking-wide">MESSAGE BOARD</span>
                </div>
              </div>
              
              {/* 主要留言內容 */}
              <div className="relative">
                {/* 引號裝飾 */}
                <div className="absolute -top-3 -left-3 text-purple-300/30 text-3xl">
                  <FaQuoteLeft />
                </div>
                <div className="absolute -bottom-3 -right-3 text-purple-300/30 text-3xl">
                  <FaQuoteRight />
                </div>
                
                {/* 留言卡片 */}
                <div className="relative bg-white/8 backdrop-blur-md p-6 rounded-2xl border border-white/15 shadow-2xl overflow-hidden">
                  {/* 內部光暈 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10"></div>
                  
                  {/* 內容 */}
                  <div className="relative z-10">
                    <p className="text-white/95 text-sm leading-relaxed font-medium tracking-wide">
                      {partner.customerMessage}
                    </p>
                  </div>
                  
                  {/* 底部裝飾 */}
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                  </div>
                </div>
              </div>
              
              {/* 底部提示 */}
              <div className="text-center mt-4">
                <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                  <p className="text-white/50 text-xs tracking-wide">CLICK TO RETURN</p>
                  <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center relative z-10">
              <div className="mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <FaComments className="text-white text-xl" />
                </div>
                <p className="text-white/60 text-sm tracking-wide">NO MESSAGE</p>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
                <p className="text-white/50 text-xs tracking-wide">CLICK TO RETURN</p>
                <div className="w-1 h-1 bg-white/60 rounded-full"></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 