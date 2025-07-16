'use client'

import Image from 'next/image'
import { useState } from 'react'
import { FaBolt } from 'react-icons/fa'

interface Partner {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
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
}

const isCloudinaryUrl = (url?: string) =>
  !!url && url.startsWith('https://res.cloudinary.com/');

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onQuickBook, flipped = false }) => {
  const nextSchedule = partner.schedules?.[0]
  const [flippedState, setFlipped] = useState(flipped)

  return (
    <div
      className="perspective w-56 h-64 max-w-full mx-auto rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col hover:shadow-2xl transition-shadow relative cursor-pointer"
      style={{ width: 224, height: 256 }}
      onClick={() => setFlipped(!flippedState)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          width: 224,
          height: 256,
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
        <Image
            src={isCloudinaryUrl(partner.coverImage) ? partner.coverImage! : '/images/placeholder.svg'}
          alt={partner.name}
          fill
          className="object-cover"
            style={{ objectPosition: 'top center', zIndex: 0 }}
          />
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
            <Image src={isCloudinaryUrl(partner.coverImage) ? partner.coverImage! : '/images/placeholder.svg'} alt={partner.name} width={80} height={80} className="object-cover w-full h-full" />
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
      {/* 3D 翻轉效果 CSS */}
      <style>{`
        .perspective { perspective: 1200px; }
      `}</style>
    </div>
  )
}

export default PartnerCard 