'use client'

import { useState, useCallback, memo, useMemo, useEffect } from 'react'
import SecureImage from './SecureImage'
import GameIcon from './GameIcon'
import { FaBolt, FaCrown, FaMedal, FaTrophy, FaComments, FaHeart, FaStar, FaQuoteLeft, FaQuoteRight, FaPaperPlane } from 'react-icons/fa'

interface Partner {
  id: string
  name: string
  games: string[]
  halfHourlyRate: number
  coverImage?: string
  images?: string[]
  supportsChatOnly?: boolean
  chatOnlyRate?: number
  schedules: { id: string; date: string; startTime: string; endTime: string, isAvailable: boolean }[]
  isAvailableNow: boolean
  isRankBooster: boolean
  customerMessage?: string
  averageRating?: number
  totalReviews?: number
  gender?: string | null
  interests?: string[]
}

interface PartnerCardProps {
  partner: Partner
  onQuickBook?: (partnerId: string) => void
  showNextStep?: boolean
  flipped?: boolean
  onFlip?: () => void
  isFavorite?: boolean
  onToggleFavorite?: (partnerId: string) => void
  isChatOnlyFilter?: boolean // 是否開啟純聊天篩選器
}

const PartnerCard = memo(function PartnerCard({ partner, onQuickBook, showNextStep = false, flipped = false, onFlip, isFavorite = false, onToggleFavorite, isChatOnlyFilter = false }: PartnerCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  // 獲取要顯示的圖片陣列：優先使用 images，如果沒有則使用 coverImage
  // 顯示順序：封面照 → 段位證明圖片，最多8張
  const displayImages = useMemo(() => {
    if (partner.images && partner.images.length > 0) {
      return partner.images.slice(0, 8) // 最多顯示8張（封面照 + 段位證明圖片）
    } else if (partner.coverImage) {
      return [partner.coverImage]
    }
    return []
  }, [partner.images, partner.coverImage])

  // 當圖片陣列改變時，重置索引
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [displayImages.length])

  const handleImageError = () => {
    setImageError(true)
  }

  // 已移除 getGameIcon 函數，改用 GameIcon 組件

  const handlePrevImage = useCallback(() => {
    if (displayImages.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length)
    }
  }, [displayImages])

  const handleNextImage = useCallback(() => {
    if (displayImages.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % displayImages.length)
    }
  }, [displayImages])

  // 手機版滑動手勢處理
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && displayImages.length > 1) {
      handleNextImage()
    }
    if (isRightSwipe && displayImages.length > 1) {
      handlePrevImage()
    }
  }

  // 性能優化：使用 useMemo 緩存計算結果
  const availableSchedules = useMemo(() => {
    return partner.schedules?.filter(schedule => schedule.isAvailable) || []
  }, [partner.schedules])

  const handleFlip = useCallback(() => {
    if (onFlip) {
      onFlip()
    }
  }, [onFlip])

  const handleToggleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // 防止觸發卡片點擊事件
    if (!onToggleFavorite || isTogglingFavorite) return
    
    setIsTogglingFavorite(true)
    try {
      onToggleFavorite(partner.id)
    } finally {
      setIsTogglingFavorite(false)
    }
  }, [onToggleFavorite, partner.id, isTogglingFavorite])

  const handleChatClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // 防止觸發卡片點擊事件
    if (isCreatingChat) return

    setIsCreatingChat(true)
    try {
      // 使用新的預聊系統
      const response = await fetch(`/api/chatrooms?partnerId=${partner.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || '無法創建聊天室，請先登入')
        return
      }

      const data = await response.json()
      // 跳轉到預聊頁面
      window.location.href = `/pre-chat/${data.chatId}?partnerId=${partner.id}`
    } catch (error) {
      console.error('Error creating chat room:', error)
      alert('無法創建聊天室，請稍後再試')
    } finally {
      setIsCreatingChat(false)
    }
  }, [partner.id, isCreatingChat])

  return (
    <div 
      className={`relative w-full transition-all duration-700 transform ${
        flipped ? 'rotate-y-180' : ''
      }`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* 正面 */}
      <div className={`w-full ${flipped ? 'hidden' : 'block'}`}>
        <div 
          className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* 圖片區域 - 正方形，確保圖片完整等比例顯示 */}
          <div 
            className="relative w-full aspect-square bg-gray-100 overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {displayImages.length > 0 ? (
              <SecureImage
                src={displayImages[currentImageIndex]}
                alt={partner.name}
                fill
                className="object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-lg">無圖片</span>
              </div>
            )}
            
            {/* 圖片切換按鈕（電腦版） */}
            {displayImages.length > 1 && (
              <>
                {/* 電腦版：當整個卡片被 hover 時顯示 */}
                <div className={`hidden md:flex absolute inset-0 items-center justify-between p-2 transition-opacity duration-200 pointer-events-none ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrevImage()
                    }}
                    className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-all pointer-events-auto z-10"
                    aria-label="上一張"
                    onMouseEnter={(e) => e.stopPropagation()}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNextImage()
                    }}
                    className="bg-black bg-opacity-60 text-white p-2 rounded-full hover:bg-opacity-80 transition-all pointer-events-auto z-10"
                    aria-label="下一張"
                    onMouseEnter={(e) => e.stopPropagation()}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                {/* 電腦版：圖片指示器（小圓點），純顯示用，不可點擊 */}
                <div className="hidden md:flex absolute bottom-2 left-1/2 transform -translate-x-1/2 gap-1.5">
                  {displayImages.map((_, index) => (
                    <div
                      key={index}
                      className={`rounded-full transition-all ${
                        index === currentImageIndex
                          ? 'bg-white w-2 h-2'
                          : 'bg-white/50 w-1.5 h-1.5'
                      }`}
                    />
                  ))}
                </div>
                
                {/* 手機版：始終顯示小圓點指示器 */}
                <div className="md:hidden absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                  {displayImages.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentImageIndex
                          ? 'bg-white'
                          : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* 狀態標籤 - 左上角 */}
            {(partner.isAvailableNow === true || partner.isRankBooster === true) && (
              <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-30 max-w-[40%]">
                {partner.isAvailableNow === true && (
                  <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg whitespace-nowrap">
                    <FaBolt className="text-yellow-300" />
                    現在有空
                  </span>
                )}
                {partner.isRankBooster === true && (
                  <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg whitespace-nowrap">
                    <FaCrown className="text-yellow-300" />
                    上分高手
                  </span>
                )}
              </div>
            )}

            {/* 評分 - 右下角 */}
            {partner.averageRating && partner.averageRating > 0 && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 whitespace-nowrap z-30">
                <FaStar className="text-yellow-400" />
                {partner.averageRating.toFixed(1)}
                {partner.totalReviews !== undefined && partner.totalReviews > 0 && ` (${partner.totalReviews})`}
              </div>
            )}

            {/* 我的最愛星星 */}
            {onToggleFavorite && (
              <button
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className={`absolute top-2 right-2 p-2 rounded-full transition-all duration-200 z-20 ${
                  isFavorite 
                    ? 'bg-yellow-400 text-yellow-900 shadow-lg' 
                    : 'bg-black bg-opacity-50 text-gray-300 hover:bg-opacity-70 hover:text-yellow-300'
                } ${isTogglingFavorite ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                title={isFavorite ? '從最愛移除' : '加入最愛'}
              >
                <FaStar className={`text-lg ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>

          {/* 內容區域 */}
          <div className="p-3">
            <h3 className="text-base font-bold text-gray-900 mb-1.5 line-clamp-1">{partner.name}</h3>
            
            {/* 遊戲標籤 */}
            <div className="flex flex-wrap gap-1 mb-2">
              {partner.games.slice(0, 2).map((game, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                >
                  <GameIcon gameName={game} size={14} />
                  <span>{game.length > 5 ? game.substring(0, 5) + '...' : game}</span>
                </span>
              ))}
              {partner.games.length > 2 && (
                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs">
                  +{partner.games.length - 2}
                </span>
              )}
            </div>

            {/* 價格 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col">
                {/* 如果開啟純聊天篩選器，且夥伴有純聊天服務，顯示純聊天價格；否則顯示一般陪玩價格 */}
                {isChatOnlyFilter && partner.supportsChatOnly && partner.chatOnlyRate ? (
                  <span className="text-lg font-bold text-purple-600">
                    純聊天 ${partner.chatOnlyRate}/30分
                  </span>
                ) : (
                  <>
                    <span className="text-lg font-bold text-green-600">
                      ${partner.halfHourlyRate}/30分
                    </span>
                    {partner.supportsChatOnly && partner.chatOnlyRate && (
                      <span className="text-xs text-purple-500 font-medium">
                        純聊天 ${partner.chatOnlyRate}/30分
                      </span>
                    )}
                  </>
                )}
              </div>
              {partner.isAvailableNow && (
                <span className="text-green-600 text-xs font-medium">即時</span>
              )}
            </div>

            {/* 按鈕區域 - 使用 flex 佈局，避免重疊 */}
            <div className="flex gap-1.5 items-center">
              {partner.isAvailableNow && onQuickBook && (
                <button
                  onClick={() => onQuickBook(partner.id)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <FaBolt className="text-xs" />
                  <span className="hidden sm:inline">立即預約</span>
                  <span className="sm:hidden">預約</span>
                </button>
              )}
              
              {/* 查看詳情按鈕 */}
              <button
                onClick={() => window.location.href = `/partners/${partner.id}/profile`}
                className={`${partner.isAvailableNow && onQuickBook ? 'flex-1' : ''} bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1`}
              >
                <FaComments className="text-xs" />
                <span className="hidden sm:inline">查看詳情</span>
                <span className="sm:hidden">詳情</span>
              </button>

              {/* 聊天按鈕 - 固定寬度，不重疊 */}
              <button
                onClick={handleChatClick}
                disabled={isCreatingChat}
                className="bg-purple-500 hover:bg-purple-600 text-white p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                title="提前聊天（免費5句）"
              >
                <FaPaperPlane className="text-xs" />
              </button>
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

            {/* 性別 */}
            {partner.gender && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-700 mb-2">性別</h4>
                <p className="text-sm text-gray-600">
                  {partner.gender === 'male' ? '男性' : partner.gender === 'female' ? '女性' : '其他'}
                </p>
              </div>
            )}

            {/* 興趣 */}
            {partner.interests && partner.interests.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-700 mb-2">興趣</h4>
                <div className="flex flex-wrap gap-2">
                  {partner.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                    >
                      {interest}
                    </span>
                  ))}
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