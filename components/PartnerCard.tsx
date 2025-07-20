'use client'

import Image from 'next/image'
import { useState } from 'react'
import { FaBolt, FaChevronLeft, FaChevronRight, FaArrowRight } from 'react-icons/fa'
import { useRouter } from 'next/navigation'

interface Partner {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
  images?: string[]; // 新增多張圖片支援
  schedules: Array<{
    date: string;
    startTime: string;
    endTime: string;
  }>;
  isAvailableNow: boolean;
  isRankBooster?: boolean;
  rankBoosterNote?: string;
  rankBoosterRank?: string;
  customerMessage?: string;
}

interface PartnerCardProps {
  partner: Partner;
  onQuickBook?: (partner: Partner, schedule: Partner['schedules'][0]) => void;
  flipped?: boolean;
  showNextStep?: boolean; // 新增控制是否顯示下一步按鈕的 prop
}

const isCloudinaryUrl = (url?: string) =>
  !!url && url.startsWith('https://res.cloudinary.com/');

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onQuickBook, flipped = false, showNextStep = false }) => {
  const nextSchedule = partner.schedules?.[0]
  const [flippedState, setFlipped] = useState(flipped)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const router = useRouter()

  // 處理圖片陣列，如果沒有多張圖片就使用 coverImage
  const images = partner.images && partner.images.length > 0 
    ? partner.images 
    : partner.coverImage 
      ? [partner.coverImage] 
      : ['/images/placeholder.svg']

  const currentImage = images[currentImageIndex]

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (images.length > 1) {
      nextImage()
    }
  }

  const handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation()
    // 跳轉到預約頁面，並傳遞夥伴ID
    router.push(`/booking?partnerId=${partner.id}`)
  }

  return (
    <div
      className={`perspective w-56 max-w-full mx-auto rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col hover:shadow-2xl transition-shadow relative cursor-pointer ${
        showNextStep ? 'h-72' : 'h-64'
      }`}
      style={{ 
        width: 224, 
        height: showNextStep ? 288 : 256 
      }}
      onClick={() => setFlipped(!flippedState)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          width: 224,
          height: showNextStep ? 256 : 256,
          transformStyle: 'preserve-3d',
          transform: flippedState ? 'rotateY(180deg)' : 'none'
        }}
      >
        {/* 正面 */}
        <div
          className="absolute w-full h-full top-0 left-0 z-10"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* 封面照全覆蓋+資訊 */}
          <div className="relative w-full h-full">
            <Image
              src={isCloudinaryUrl(currentImage) ? currentImage : currentImage}
              alt={partner.name}
              fill
              className="object-cover cursor-pointer"
              style={{ objectPosition: 'top center', zIndex: 0 }}
              onClick={handleImageClick}
            />
            
            {/* 圖片導航指示器 */}
            {images.length > 1 && (
              <div className="absolute top-2 right-2 flex gap-1">
                {images.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentImageIndex 
                        ? 'bg-white shadow-lg' 
                        : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* 左右滑動按鈕 */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    prevImage()
                  }}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors z-20"
                >
                  <FaChevronLeft size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    nextImage()
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors z-20"
                >
                  <FaChevronRight size={12} />
                </button>
              </>
            )}
          </div>

          <div className="absolute inset-0 flex flex-col justify-end z-10">
            {/* 上方標籤 */}
            <div className="absolute top-2 left-2 flex gap-2">
              {partner.isAvailableNow && (
                <span className="flex items-center gap-1 px-2 h-6 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg animate-pulse">
                  <FaBolt className="text-yellow-200 text-base" />
                  <span>現在有空</span>
                </span>
              )}
              {partner.isRankBooster && (
                <span className="inline-block bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow ml-1">上分高手</span>
              )}
            </div>
            {/* 下方漸層遮罩+資訊 */}
            <div className="w-full pt-12 pb-3 px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <h3 className="text-lg font-bold text-white mb-1 truncate drop-shadow">{partner.name}</h3>
              <div className="flex flex-wrap gap-1 mb-1">
                {partner.games?.map((game: string) => (
                  <span key={game} className="inline-block bg-purple-200/80 text-purple-800 px-2 py-0.5 rounded-full text-xs font-semibold drop-shadow">
                    {game}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-cyan-200 font-bold text-base drop-shadow">${partner.halfHourlyRate}</span>
                <span className="text-xs text-gray-100/80">/半小時</span>
              </div>
            </div>
          </div>
        </div>
        {/* 背面 */}
        <div
          className="absolute w-full h-full top-0 left-0 z-20 bg-white/90 dark:bg-slate-900/90 flex flex-col items-center justify-center px-4 py-6 rounded-2xl border border-gray-200 dark:border-gray-700 [transform:rotateY(180deg)]"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="w-20 h-20 rounded-xl overflow-hidden border-4 border-blue-200 mb-2">
            <Image src={isCloudinaryUrl(currentImage) ? currentImage : currentImage} alt={partner.name} width={80} height={80} className="object-cover w-full h-full" />
          </div>
          <div className="font-bold text-base text-blue-900 dark:text-blue-100 mb-1">{partner.name}</div>
          <div className="w-full max-w-[180px] mx-auto bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-inner p-2 text-center mb-2">
            <div className="text-blue-800 dark:text-blue-200 font-semibold mb-1">留言板</div>
            <div className="text-blue-900 dark:text-blue-100 text-xs min-h-[24px]">
              {partner.customerMessage ? partner.customerMessage : <span className="text-gray-400">（尚未填寫留言）</span>}
            </div>
          </div>
          <div className="text-xs text-blue-400">（點擊卡片任意處返回）</div>
        </div>
      </div>
      
      {/* 下一步按鈕 - 只在 showNextStep 為 true 時顯示 */}
      {showNextStep && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-white via-white/95 to-transparent">
          <button
            onClick={handleNextStep}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold py-2 px-4 rounded-lg shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <span>下一步</span>
            <FaArrowRight size={14} />
          </button>
        </div>
      )}
      
      {/* 3D 翻轉效果 CSS */}
      <style>{`
        .perspective { perspective: 1200px; }
      `}</style>
    </div>
  )
}

export default PartnerCard 