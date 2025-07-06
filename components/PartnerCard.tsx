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
      className="w-72 max-w-full mx-auto rounded-xl shadow-lg bg-white dark:bg-slate-900 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{ minHeight: 380 }}
    >
      {/* 封面照 */}
      <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-800">
        <Image
          src={partner.coverImage || '/images/placeholder.svg'}
          alt={partner.name}
          fill
          className="object-cover"
        />
      </div>
      {/* 內容區塊 */}
      <div className="flex-1 flex flex-col p-4 gap-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{partner.name}</h3>
        <div className="flex flex-wrap gap-2 mb-1">
          {partner.games?.map((game: string) => (
            <span key={game} className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
              {game}
            </span>
          ))}
        </div>
        <div className="text-gray-500 dark:text-gray-300 text-xs mb-1">每小時 {partner.hourlyRate} 元</div>
        {partner.customerMessage && (
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2 text-blue-900 dark:text-blue-100 text-xs mt-1">
            <span className="font-semibold">留言板：</span>{partner.customerMessage}
          </div>
        )}
        {/* 其他資訊可依需求加入 */}
      </div>
    </div>
  )
}

export default PartnerCard 