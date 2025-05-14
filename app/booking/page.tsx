'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useSearchParams } from 'next/navigation'

const bookingSchema = z.object({
  name: z.string().min(2, '姓名至少需要2個字'),
  birthday: z.string().min(1, '請選擇生日'),
  phone: z.string().min(10, '請輸入有效的電話號碼'),
  partnerId: z.string().min(1, '請選擇遊戲夥伴'),
  date: z.string().min(1, '請選擇日期').refine((date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, '不能選擇過去的日期'),
  startTime: z.string().min(1, '請選擇開始時間'),
  duration: z.number().min(1, '請選擇時數'),
})
.superRefine((data, ctx) => {
  // 驗證不能預約過去的時間
  const [hours, minutes] = data.startTime.split(':').map(Number);
  const now = new Date();
  const selectedDate = new Date(data.date);
  const selectedDateTime = new Date(selectedDate);
  selectedDateTime.setHours(hours, minutes, 0, 0);
  if (selectedDate.toDateString() === now.toDateString()) {
    if (selectedDateTime <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '不能選擇過去的時間',
        path: ['startTime'],
      });
    }
  }
});

type BookingFormData = z.infer<typeof bookingSchema>

interface Partner {
  id: string
  name: string
  games: string[]
  hourlyRate: number
  schedules: Array<{
    id: string
    date: string
    startTime: string
    endTime: string
    isAvailable: boolean
  }>
}

export default function BookingPage() {
  return (
    <div className="max-w-2xl mx-auto mt-16 bg-white/10 rounded-xl p-8 shadow-lg backdrop-blur">
      <h2 className="text-2xl font-bold mb-6 text-center">預約</h2>
      <p className="text-gray-300 text-center">這裡是顧客預約頁面，之後會顯示可預約時段與夥伴。</p>
    </div>
  )
} 