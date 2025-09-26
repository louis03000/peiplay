'use client'

import { useState } from 'react'
import Image from 'next/image'

interface RankBoosterImageCarouselProps {
  images: string[]
  partnerName: string
}

export default function RankBoosterImageCarousel({ images, partnerName }: RankBoosterImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)

  if (!images || images.length === 0) {
    return null
  }

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const openModal = () => {
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  return (
    <>
      {/* 圖片輪播 */}
      <div className="relative bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-purple-700">🏆 段位證明</span>
            <span className="text-xs text-purple-600">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
          {images.length > 1 && (
            <div className="flex space-x-1">
              <button
                onClick={prevImage}
                className="p-1 rounded-full bg-white/80 hover:bg-white transition-colors"
                disabled={images.length <= 1}
              >
                <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextImage}
                className="p-1 rounded-full bg-white/80 hover:bg-white transition-colors"
                disabled={images.length <= 1}
              >
                <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        <div 
          className="relative aspect-video bg-white rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          onClick={openModal}
        >
          <Image
            src={images[currentIndex]}
            alt={`${partnerName} 的段位證明 ${currentIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
            <div className="opacity-0 hover:opacity-100 bg-white/90 rounded-full p-2 transition-opacity">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* 點點指示器 */}
        {images.length > 1 && (
          <div className="flex justify-center space-x-1 mt-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-purple-600' : 'bg-purple-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 模態框 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={closeModal}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* 關閉按鈕 */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 圖片導航 */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* 圖片 */}
            <div className="relative w-full h-[80vh]">
              <Image
                src={images[currentIndex]}
                alt={`${partnerName} 的段位證明 ${currentIndex + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>

            {/* 底部資訊 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-4">
              <div className="text-white">
                <h3 className="text-lg font-semibold">{partnerName} 的段位證明</h3>
                <p className="text-sm opacity-90">
                  {currentIndex + 1} / {images.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
