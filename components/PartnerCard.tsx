'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import React from 'react'

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
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg hover:shadow-2xl transition-shadow overflow-hidden flex flex-col relative">
      <div className="relative w-full h-48">
        <Image
          src={partner.coverImage || '/images/placeholder.svg'}
          alt={partner.name}
          fill
          className="object-cover"
        />
        {partner.isAvailableNow && (
          <div className="absolute top-3 left-3 flex items-center z-10">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg animate-pulse">
              現在有空
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col px-6 py-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{partner.name}</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {partner.games?.map((game: string) => (
            <span key={game} className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
              {game}
            </span>
          ))}
        </div>
        <div className="text-gray-500 dark:text-gray-300 text-sm mb-2">每小時 {partner.hourlyRate} 元</div>
        {nextSchedule && (
          <div className="text-xs text-green-600 mb-2">最近有空：{nextSchedule.date} {nextSchedule.startTime}~{nextSchedule.endTime}</div>
        )}
        <div className="flex-1" />
        <div className="mt-4 flex gap-2">
          <Link
            href={`/booking?partnerId=${partner.id}`}
            className="flex-1 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-center shadow hover:scale-105 transition-transform"
          >
            立即預約
          </Link>
          <button
            className="px-4 py-2 rounded-full border border-purple-400 text-purple-600 font-semibold bg-white hover:bg-purple-50 transition"
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