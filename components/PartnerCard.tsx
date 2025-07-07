'use client'

import Image from 'next/image'
import { useState } from 'react'
import { FaBolt } from 'react-icons/fa'

interface Partner {
  id: string;
  name: string;
  games: string[];
  hourlyRate: number;
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
      className="w-56 h-64 max-w-full mx-auto rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col hover:shadow-2xl transition-shadow relative"
      style={{ width: 224, height: 256 }}
    >
      {/* 封面照全覆蓋 */}
      <Image
        src={isCloudinaryUrl(partner.coverImage) ? partner.coverImage! : '/images/placeholder.svg'}
        alt={partner.name}
        fill
        className="object-cover"
        style={{ objectPosition: 'top center', zIndex: 0 }}
      />
      {/* 上層資訊區塊（漸層遮罩+內容） */}
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
            <span className="text-cyan-200 font-bold text-base drop-shadow">${partner.hourlyRate}</span>
            <span className="text-xs text-gray-100/80">/小時</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PartnerCard 