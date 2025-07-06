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
      className="w-56 h-64 max-w-full mx-auto rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col hover:shadow-2xl transition-shadow"
      style={{ width: 224, height: 256 }}
    >
      {/* 封面照區塊 */}
      <div className="relative w-full" style={{ height: '60%' }}>
        <Image
          src={isCloudinaryUrl(partner.coverImage) ? partner.coverImage! : '/images/placeholder.svg'}
          alt={partner.name}
          fill
          className="object-cover"
          style={{ objectPosition: 'top center' }}
        />
        {partner.isAvailableNow && (
          <div className="absolute top-2 left-2 z-10">
            <span className="flex items-center gap-1 px-2 h-6 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg animate-pulse">
              <FaBolt className="text-yellow-200 text-base" />
              <span>現在有空</span>
            </span>
          </div>
        )}
      </div>
      {/* 資訊區塊 */}
      <div className="flex-1 flex flex-col px-3 pt-2 pb-3 gap-1 justify-between bg-gradient-to-b from-white via-gray-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 truncate">{partner.name}</h3>
          <div className="flex flex-wrap gap-1 mb-1">
            {partner.games?.map((game: string) => (
              <span key={game} className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                {game}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-indigo-600 dark:text-indigo-300 font-bold text-base">${partner.hourlyRate}</span>
          <span className="text-xs text-gray-500 dark:text-gray-300">/小時</span>
        </div>
        {partner.isRankBooster && (
          <span className="inline-block bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow mt-1">上分高手</span>
        )}
      </div>
    </div>
  )
}

export default PartnerCard 