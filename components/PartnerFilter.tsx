'use client'

import { useState } from 'react'

export default function PartnerFilter({ onFilter }: { onFilter: (start: string, end: string) => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  return (
    <form
      className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-center mb-8"
      onSubmit={e => {
        e.preventDefault()
        onFilter(startDate, endDate)
      }}
    >
      <input
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
        placeholder="年/月/日"
      />
      <span className="text-gray-500">至</span>
      <input
        type="date"
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition bg-white text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
        placeholder="年/月/日"
      />
      <button
        type="submit"
        className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow hover:scale-105 transition-transform"
      >
        篩選
      </button>
    </form>
  )
} 