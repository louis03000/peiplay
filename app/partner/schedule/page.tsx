'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const scheduleSchema = z.object({
  date: z.string().min(1, '請選擇日期'),
  startTime: z.string().min(1, '請選擇開始時間'),
  endTime: z.string().min(1, '請選擇結束時間'),
  isRecurring: z.boolean(),
  recurringWeeks: z.number().min(1).max(12).optional(),
}).refine((data) => {
  const start = parseISO(`${data.date}T${data.startTime}`)
  const end = parseISO(`${data.date}T${data.endTime}`)
  return start < end
}, {
  message: '結束時間必須晚於開始時間',
  path: ['endTime'],
})

type ScheduleFormData = z.infer<typeof scheduleSchema>

interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  isAvailable: boolean
  isRecurring?: boolean
  recurringWeeks?: number
}

interface Reminder {
  scheduleId: string
  bookingId: string
  customerName: string
  customerPhone: string
  date: string
  startTime: string
  endTime: string
  hoursUntilStart: number
}

interface ScheduleStats {
  overallStats: {
    totalSlots: number
    bookedSlots: number
    utilizationRate: number
  }
  popularTimeSlots: Array<{
    timeSlot: string
    count: number
  }>
  weeklyStats: Array<{
    week: number
    startDate: string
    endDate: string
    totalSlots: number
    bookedSlots: number
    utilizationRate: number
  }>
}

export default function PartnerSchedulePage() {
  return (
    <div className="max-w-2xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">夥伴時段管理</h2>
      <p className="text-gray-300 text-center">這裡是夥伴管理自己可預約時段的頁面。</p>
    </div>
  )
} 