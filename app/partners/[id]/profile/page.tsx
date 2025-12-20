'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { calculateZodiacSign, calculateAge, formatDateChinese } from '@/lib/zodiac'
import SecureImage from '@/components/SecureImage'

interface PartnerProfile {
  id: string
  name: string
  birthday: string
  gender?: string
  interests: string[]
  games: string[]
  supportsChatOnly: boolean
  chatOnlyRate?: number | null
  halfHourlyRate: number
  customerMessage: string | null
  images: string[]
  isRankBooster?: boolean
  rankBoosterImages?: string[]
  rankBoosterNote?: string | null
  rankBoosterRank?: string | null
  reviewsReceived: Review[]
  user: {
    name: string
  }
}

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewer: {
    name: string
  }
}

export default function PartnerProfilePage() {
  const params = useParams()
  const partnerId = params.id as string
  const [partner, setPartner] = useState<PartnerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // 獲取要顯示的圖片陣列：包含普通圖片和上分高手圖片
  const displayImages = useMemo(() => {
    if (!partner) return []
    let images = partner.images || []
    // 如果有上分高手圖片，合併進去
    if (partner.isRankBooster && partner.rankBoosterImages?.length) {
      images = [...images, ...partner.rankBoosterImages]
    }
    return images.slice(0, 10) // 允許顯示更多圖片（包含段位證明）
  }, [partner])

  // 當圖片陣列改變時，重置索引
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [displayImages.length])

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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      setCurrentImageIndex((prev) => {
        if (displayImages.length > 1) {
          return (prev + 1) % displayImages.length
        }
        return prev
      })
    }
    if (isRightSwipe) {
      setCurrentImageIndex((prev) => {
        if (displayImages.length > 1) {
          return (prev - 1 + displayImages.length) % displayImages.length
        }
        return prev
      })
    }
  }, [touchStart, touchEnd, displayImages.length])

  const fetchPartnerProfile = useCallback(async () => {
    if (!partnerId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/partners/${partnerId}/profile`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        throw new Error('無法載入夥伴資料')
      }
      
      const data = await response.json()
      setPartner(data.partner)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    fetchPartnerProfile()
  }, [fetchPartnerProfile])

  // 計算生日、年齡、星座（必須在所有條件返回之前調用）
  const birthdayString = partner?.birthday || null
  const { birthday, age, zodiacSign } = useMemo(() => {
    if (!birthdayString) {
      return {
        birthday: new Date(),
        age: 0,
        zodiacSign: '未知'
      }
    }
    try {
      const bday = new Date(birthdayString)
      if (isNaN(bday.getTime())) {
        return {
          birthday: new Date(),
          age: 0,
          zodiacSign: '未知'
        }
      }
      return {
        birthday: bday,
        age: calculateAge(bday),
        zodiacSign: calculateZodiacSign(bday)
      }
    } catch (err) {
      console.error('計算生日資訊時發生錯誤:', err)
      return {
        birthday: new Date(),
        age: 0,
        zodiacSign: '未知'
      }
    }
  }, [birthdayString])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">載入中...</p>
        </div>
      </div>
    )
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-gray-900 text-2xl font-bold mb-2">載入失敗</h1>
          <p className="text-gray-600">{error || '找不到夥伴資料'}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <div className="min-h-screen bg-white" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitOverflowScrolling: 'touch' }}>
      {/* 背景裝飾 - 移除漸變背景 */}
      <div className="fixed inset-0 bg-white pointer-events-none" style={{ transform: 'translate3d(0,0,0)', willChange: 'auto' }}></div>
      
      <div className="relative max-w-6xl mx-auto px-4 py-8" style={{ transform: 'translateZ(0)' }}>
        {/* 返回按鈕 */}
        <div className="mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-gray-600 hover:text-gray-900"
            style={{ transition: 'color 0.1s ease-out' }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>
        </div>

        {/* 主要內容 - 使用 GPU 加速優化滾動 */}
        <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
          {/* 圖片輪播區（如果有圖片） */}
          {displayImages.length > 0 && (
            <div 
              className="relative w-full h-96 md:h-[500px] lg:h-[600px]"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
            >
              <SecureImage
                src={displayImages[currentImageIndex]}
                alt={`${partner.name} 的照片 ${currentImageIndex + 1}`}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 80vw"
              />
              
              {/* 電腦版：左右箭頭 */}
              {displayImages.length > 1 && (
                <div className="hidden md:flex absolute inset-0 items-center justify-between p-4 pointer-events-none">
                  <button
                    onClick={handlePrevImage}
                    className="bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 pointer-events-auto"
                    aria-label="上一張"
                    style={{ transition: 'opacity 0.15s ease-out', transform: 'translateZ(0)' }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 pointer-events-auto"
                    aria-label="下一張"
                    style={{ transition: 'opacity 0.15s ease-out', transform: 'translateZ(0)' }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* 圖片指示器 */}
              {displayImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                  {displayImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full ${
                        index === currentImageIndex
                          ? 'bg-gray-300 w-6'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                      aria-label={`查看圖片 ${index + 1}`}
                      style={{ transition: 'width 0.2s ease-out, background-color 0.15s ease-out', transform: 'translateZ(0)' }}
                    />
                  ))}
                </div>
              )}
              
              {/* 圖片計數器 */}
              {displayImages.length > 1 && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1} / {displayImages.length}
                </div>
              )}
            </div>
          )}
          
          {/* 頭部區域 */}
          <div className="relative bg-gray-800 p-8 border-b border-gray-700">
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              {/* 頭像 */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-gray-600 shadow-lg overflow-hidden">
                  {partner.images && partner.images.length > 0 ? (
                    <SecureImage
                      src={partner.images[0]}
                      alt={partner.name}
                      fill
                      className="object-cover"
                      priority
                      sizes="128px"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center">
                      <span className="text-white font-bold text-4xl">{partner.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-2 border-gray-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* 基本資訊 */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-white mb-2">{partner.name}</h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-white">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {age}歲 • {zodiacSign}
                  </div>
                  {partner.gender && (
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {partner.gender === 'male' ? '男性' : partner.gender === 'female' ? '女性' : '其他'}
                    </div>
                  )}
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    NT$ {partner.halfHourlyRate}/半小時
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 內容區域 - 使用 GPU 加速 */}
          <div className="p-8" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 左側：基本資訊 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 興趣 */}
                {partner.interests.length > 0 && (
                  <div className="bg-gray-700 rounded-xl p-6 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      興趣
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {partner.interests.map((interest, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 擅長遊戲 */}
                <div className="bg-gray-700 rounded-xl p-6 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9-4V9a2 2 0 012-2h4a2 2 0 012 2v1M7 7h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" />
                    </svg>
                    擅長遊戲
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {partner.games.map((game, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                      >
                        {game === 'chat' ? '純聊天' : game}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 純聊天服務 */}
                {partner.supportsChatOnly && (
                  <div className="bg-gray-700 rounded-xl p-6 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      純聊天服務
                    </h3>
                    <div className="text-green-300">
                      <p className="text-lg font-medium">NT$ {partner.chatOnlyRate}/小時</p>
                      <p className="text-sm text-gray-400 mt-1">提供純聊天陪聊服務</p>
                    </div>
                  </div>
                )}

                {/* 留言板 */}
                <div className="bg-gray-700 rounded-xl p-6 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    留言板
                  </h3>
                  {partner.customerMessage ? (
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                      {partner.customerMessage}
                    </p>
                  ) : (
                    <p className="text-gray-400 italic">夥伴還沒有留下任何訊息</p>
                  )}
                </div>

                {/* 所有照片 */}
                {partner.images.length > 0 && (
                  <div className="bg-gray-700 rounded-xl p-6 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      所有照片
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {partner.images.map((image, index) => (
                        <div 
                          key={index} 
                          className="relative group aspect-square"
                          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', contentVisibility: index > 5 ? 'auto' : 'visible' }}
                        >
                          <SecureImage
                            src={image}
                            alt={`${partner.name} 的照片 ${index + 1}`}
                            fill
                            className="object-cover rounded-lg border border-gray-600"
                            sizes="(max-width: 768px) 50vw, 33vw"
                            loading={index < 3 ? 'eager' : 'lazy'}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center" style={{ transition: 'opacity 0.2s ease-out', transform: 'translateZ(0)' }}>
                            <button
                              onClick={() => window.open(image, '_blank')}
                              className="text-white hover:text-blue-300"
                              style={{ transition: 'color 0.15s ease-out', transform: 'translateZ(0)' }}
                            >
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 右側：評價 */}
              <div className="space-y-6" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                <div className="bg-gray-700 rounded-xl p-6 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: 'auto' }}>
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    所有評價
                  </h3>
                  
                  {partner.reviewsReceived.length > 0 ? (
                    <div className="space-y-4">
                      {partner.reviewsReceived.map((review, index) => (
                        <div key={review.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600" style={{ transform: 'translateZ(0)', contentVisibility: index > 2 ? 'auto' : 'visible' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <span className="text-white font-medium">{review.reviewer.name}</span>
                              <div className="flex ml-2">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-500'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                            </div>
                            <span className="text-gray-400 text-sm">
                              {new Date(review.createdAt).toLocaleDateString('zh-TW')}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="text-gray-200 text-sm">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-gray-400">還沒有評價</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
