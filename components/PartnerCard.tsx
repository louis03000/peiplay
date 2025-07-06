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

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onQuickBook, flipped = false }) => {
  const nextSchedule = partner.schedules?.[0]

  return (
    <div
      className="perspective w-72 max-w-full mx-auto cursor-pointer"
      style={{ minHeight: 340 }}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          minHeight: 340,
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'none'
        }}
      >
        {/* 正面 */}
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow overflow-hidden flex flex-col absolute w-full h-full top-0 left-0 group z-10 border border-gray-200 dark:border-gray-700"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* 封面照 */}
          <div className="relative w-full h-36 bg-gray-100 dark:bg-gray-800">
            <Image
              src={partner.coverImage || '/images/placeholder.svg'}
              alt={partner.name}
              fill
              className="object-cover"
            />
            {partner.isAvailableNow && (
              <div className="absolute top-3 left-3 flex items-center z-10">
                <span className="flex items-center gap-1 px-3 h-7 rounded-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-400 text-white text-xs font-bold border border-white/60 shadow-lg shadow-green-200/50 backdrop-blur-[2px] drop-shadow-md animate-pulse" style={{ boxShadow: '0 2px 8px 0 #6ee7b7cc' }}>
                  <FaBolt className="text-yellow-200 text-base drop-shadow-[0_0_6px_#fef08a]" />
                  <span className="text-shadow">現在有空</span>
                </span>
              </div>
            )}
          </div>
          {/* 內容區塊 */}
          <div className="flex-1 flex flex-col px-4 pt-3 pb-4 gap-1 justify-between">
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
            <div className="flex items-center gap-2 mt-1">
              <span className="text-indigo-600 dark:text-indigo-300 font-bold text-base">${partner.hourlyRate}</span>
              <span className="text-xs text-gray-500 dark:text-gray-300">/小時</span>
            </div>
            {partner.isRankBooster && (
              <span className="inline-block bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow mt-1">上分高手</span>
            )}
          </div>
        </div>
        {/* 背面 */}
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col absolute w-full h-full top-0 left-0 z-20 [transform:rotateY(180deg)] cursor-pointer border border-gray-200 dark:border-gray-700"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            <div className="w-20 h-20 rounded-xl overflow-hidden border-4 border-blue-200 mb-3">
              <Image src={partner.coverImage || '/images/placeholder.svg'} alt={partner.name} width={80} height={80} className="object-cover w-full h-full" />
            </div>
            <div className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-2">{partner.name}</div>
            <div className="w-full max-w-[220px] mx-auto bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700 shadow-inner p-4 text-center">
              <div className="text-blue-800 dark:text-blue-200 font-semibold mb-2">留言板</div>
              <div className="text-blue-900 dark:text-blue-100 text-sm min-h-[32px]">
                {partner.customerMessage ? partner.customerMessage : <span className="text-gray-400">（尚未填寫留言）</span>}
              </div>
            </div>
            <div className="mt-4 text-xs text-blue-400">（點擊卡片任意處返回）</div>
          </div>
        </div>
      </div>
      {/* 3D 翻轉效果 CSS */}
      <style>{`
        .perspective { perspective: 1200px; }
        .text-shadow { text-shadow: 0 1px 4px rgba(0,0,0,0.18), 0 0px 2px #fff2; }
      `}</style>
    </div>
  )
}

export default PartnerCard 