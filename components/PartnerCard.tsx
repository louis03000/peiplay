'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import React from 'react'
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
}

interface PartnerCardProps {
  partner: Partner;
  onQuickBook: (partner: Partner, schedule: Partner['schedules'][0]) => void;
}

const PartnerCard: React.FC<PartnerCardProps> = ({ partner, onQuickBook }) => {
  const [showConfirm, setShowConfirm] = useState(false)
  const nextSchedule = partner.schedules?.[0]

  const handleQuickBook = () => {
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    setShowConfirm(false)
    if (onQuickBook && nextSchedule) onQuickBook(partner, nextSchedule)
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow overflow-hidden flex flex-col relative w-64 max-w-full mx-auto">
      <div className="relative w-full h-32">
        <Image
          src={partner.coverImage || '/images/placeholder.svg'}
          alt={partner.name}
          fill
          className="object-cover"
        />
        {partner.isAvailableNow && (
          <div className="absolute top-3 left-3 flex items-center z-10">
            <span className="flex items-center gap-1 px-3 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white text-xs font-bold border-2 border-white shadow-md animate-pulse">
              <FaBolt className="text-yellow-200 text-sm" />
              現在有空
            </span>
          </div>
        )}
        {partner.isRankBooster && (
          <div className="absolute top-3 right-3 flex items-center z-10">
            <span className="flex items-center gap-1 px-3 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-xs font-bold border-2 border-white shadow-md">
              🏆 上分高手
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col px-4 py-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{partner.name}</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {partner.games?.map((game: string) => (
            <span key={game} className="inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-semibold">
              {game}
            </span>
          ))}
        </div>
        <div className="text-gray-500 dark:text-gray-300 text-xs mb-2">每小時 {partner.hourlyRate} 元</div>
        <div className="flex-1" />
        <div className="mt-3 flex gap-2">
          <Link
            href={`/booking?partnerId=${partner.id}`}
            className="flex-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-center shadow hover:scale-105 transition-transform text-sm"
          >
            立即預約
          </Link>
          <button
            className="px-3 py-1.5 rounded-full border border-purple-400 text-purple-600 font-semibold bg-white hover:bg-purple-50 transition text-sm"
            onClick={handleQuickBook}
            type="button"
            disabled={!nextSchedule}
            title={!nextSchedule ? '暫無可預約時段' : ''}
          >
            即時預約
          </button>
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
  )
}

export default PartnerCard 