'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import React from 'react'
import { FaBolt, FaCrown } from 'react-icons/fa'

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
  onQuickBook: (partner: Partner, schedule: Partner['schedules'][0]) => void;
}

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onQuickBook }) => {
  const [showConfirm, setShowConfirm] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const nextSchedule = partner.schedules?.[0]

  const handleQuickBook = () => {
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    setShowConfirm(false)
    if (onQuickBook && nextSchedule) onQuickBook(partner, nextSchedule)
  }

  return (
    <div
      className="perspective w-64 max-w-full mx-auto"
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
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow overflow-hidden flex flex-col absolute w-full h-full top-0 left-0 cursor-pointer group z-10"
          style={{ backfaceVisibility: 'hidden' }}
          onClick={() => setFlipped(true)}
        >
          <div className="flex flex-col h-full">
            {/* 上方 3/4 封面圖 */}
            <div className="relative" style={{ height: '75%' }}>
              <Image
                src={partner.coverImage || '/images/placeholder.svg'}
                alt={partner.name}
                fill
                className="object-cover rounded-t-2xl"
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              />
              {partner.isAvailableNow && (
                <div className="absolute top-3 left-3 flex items-center z-10">
                  <span className="flex items-center gap-1 px-3 h-8 rounded-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-400 text-white text-sm font-bold border border-white/60 shadow-lg shadow-green-200/50 backdrop-blur-[2px] drop-shadow-md animate-pulse" style={{ boxShadow: '0 2px 8px 0 #6ee7b7cc' }}>
                    <FaBolt className="text-yellow-200 text-lg drop-shadow-[0_0_6px_#fef08a]" />
                    <span className="text-shadow">現在有空</span>
                  </span>
                </div>
              )}
              {partner.isRankBooster && (
                <div className="absolute top-3 right-3 flex items-center z-10">
                  <span className="flex items-center gap-1 px-3 h-8 rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-sm font-bold border border-white/60 shadow-lg shadow-orange-200/40 backdrop-blur-[2px] drop-shadow-md group-hover:scale-105 transition-transform" style={{ boxShadow: '0 2px 8px 0 #fdba74cc' }}>
                    <span className="text-yellow-100 text-lg drop-shadow-[0_0_6px_#fde68a]">🏆</span>
                    <span className="text-shadow">上分高手</span>
                  </span>
                </div>
              )}
            </div>
            {/* 下方 1/4 資訊區塊 */}
            <div className="flex flex-col items-center justify-center text-center px-4" style={{ height: '25%' }}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 mt-2">{partner.name}</h3>
              <div className="flex flex-wrap gap-2 mb-1 justify-center">
                {partner.games?.map((game: string) => (
                  <span key={game} className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {game}
                  </span>
                ))}
              </div>
              <div className="text-gray-500 dark:text-gray-300 text-xs">每小時 {partner.hourlyRate} 元</div>
            </div>
          </div>
          {showConfirm && nextSchedule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-xs w-full text-center">
                <h4 className="text-lg font-bold mb-2">確認即時預約？</h4>
                <div className="mb-4 text-sm text-gray-700">
                  {partner.name} <br />
                  {nextSchedule.date} {nextSchedule.startTime}~{nextSchedule.endTime}
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow"
                    onClick={handleConfirm}
                  >
                    確認
                  </button>
                  <button
                    className="px-4 py-2 rounded-full border border-gray-300 text-gray-600 bg-white hover:bg-gray-100"
                    onClick={() => setShowConfirm(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* 背面 */}
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden flex flex-col absolute w-full h-full top-0 left-0 z-20 [transform:rotateY(180deg)] cursor-pointer"
          style={{ backfaceVisibility: 'hidden' }}
          onClick={() => setFlipped(false)}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
            <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-blue-200 mb-3">
              <Image src={partner.coverImage || '/images/placeholder.svg'} alt={partner.name} width={64} height={64} className="object-cover w-full h-full" />
            </div>
            <div className="font-bold text-lg text-blue-900 mb-2">{partner.name}</div>
            <div className="w-full max-w-[180px] mx-auto bg-blue-50 rounded-xl border border-blue-200 shadow-inner p-4 text-center">
              <div className="text-blue-800 font-semibold mb-2">留言板</div>
              <div className="text-blue-900 text-sm min-h-[32px]">
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