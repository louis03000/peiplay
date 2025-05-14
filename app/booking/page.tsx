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
  const [step, setStep] = useState(1)
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null)
  const [isLoadingPartners, setIsLoadingPartners] = useState(false)
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingData, setBookingData] = useState<BookingFormData | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const searchParams = useSearchParams()
  const partnerId = searchParams.get('partnerId')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  })

  // Step 1: 取得夥伴
  useEffect(() => {
    setIsLoadingPartners(true)
    fetch('/api/partners')
      .then(res => res.json())
      .then(data => {
        setPartners(data)
        if (partnerId) {
          const found = data.find((p: Partner) => p.id === partnerId)
          if (found) setSelectedPartner(found)
        }
      })
      .finally(() => setIsLoadingPartners(false))
  }, [partnerId])

  // Step 2: 取得可預約時段
  useEffect(() => {
    if (selectedPartner) {
      setIsLoadingSchedules(true)
      fetch(`/api/schedules?partnerId=${selectedPartner.id}`)
        .then(res => res.json())
        .then(data => setAvailableSchedules(data))
        .finally(() => setIsLoadingSchedules(false))
    }
  }, [selectedPartner])

  // 分步驟送出
  const onStep1 = (id: string) => {
    const partner = partners.find(p => p.id === id)
    setSelectedPartner(partner || null)
    setValue('partnerId', id)
    setStep(2)
  }
  const onStep2 = (schedule: any, duration: number) => {
    setSelectedSchedule(schedule)
    setValue('date', schedule.date)
    setValue('startTime', schedule.startTime)
    setValue('duration', duration)
    setStep(3)
  }
  const onStep3 = handleSubmit(async (data) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '預約失敗')
      }
      setBookingData(data)
      setIsSubmitted(true)
    } catch (error) {
      alert(error instanceof Error ? error.message : '預約失敗')
    } finally {
      setIsSubmitting(false)
    }
  })

  if (isSubmitted && bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">預約成功！</h2>
                <p className="mt-2 text-gray-300">您的預約資訊如下：</p>
              </div>
              <div className="mt-6 border-t border-white/10">
                <dl className="divide-y divide-white/10">
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-300">姓名</dt>
                    <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">{bookingData.name}</dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-300">預約日期</dt>
                    <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">{new Date(bookingData.date).toLocaleDateString('zh-TW')}</dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-300">開始時間</dt>
                    <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">{bookingData.startTime}</dd>
                  </div>
                  <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm font-medium text-gray-300">時數</dt>
                    <dd className="mt-1 text-sm text-white sm:col-span-2 sm:mt-0">{bookingData.duration} 小時</dd>
                  </div>
                </dl>
              </div>
              <div className="mt-6 text-center">
                <button onClick={() => { setIsSubmitted(false); setBookingData(null); setStep(1); reset(); }} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200">
                  返回首頁
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">預約遊戲夥伴</h1>
          <p className="mt-3 text-xl text-gray-300">填寫以下資料，開始您的遊戲時光</p>
        </div>
        <div className="mt-12">
          <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
            <div className="px-4 py-5 sm:p-6">
              {/* Stepper */}
              <div className="flex justify-center mb-8">
                {[1,2,3].map((s) => (
                  <div key={s} className={`flex-1 h-2 mx-1 rounded-full ${step>=s?'bg-indigo-500':'bg-white/20'}`}></div>
                ))}
              </div>
              {/* Step 1: 選擇夥伴 */}
              {step === 1 && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">選擇遊戲夥伴</h2>
                  {isLoadingPartners ? <div className="text-gray-300">載入中...</div> : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {partners.map((p) => (
                        <div key={p.id} className={`rounded-lg p-4 cursor-pointer border-2 ${selectedPartner?.id===p.id?'border-indigo-500 bg-indigo-900/30':'border-white/10 bg-white/5'} hover:border-indigo-400 transition`} onClick={()=>onStep1(p.id)}>
                          <div className="text-lg font-bold text-white">{p.name}</div>
                          <div className="text-sm text-gray-300 mb-1">時薪：${p.hourlyRate}</div>
                          <div className="text-sm text-gray-300">專長遊戲：{p.games?.join('、')||'無'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Step 2: 選擇時段 */}
              {step === 2 && selectedPartner && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">選擇預約時段</h2>
                  {isLoadingSchedules ? <div className="text-gray-300">載入中...</div> : (
                    <div className="space-y-4">
                      {availableSchedules.length === 0 && <div className="text-gray-300">暫無可預約時段</div>}
                      {availableSchedules.map((s) => {
                        const start = new Date(`${s.date}T${s.startTime}`);
                        const end = new Date(`${s.date}T${s.endTime}`);
                        const maxHours = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
                        return (
                          <div key={s.id} className={`rounded-lg p-4 flex justify-between items-center border-2 ${selectedSchedule?.id===s.id?'border-indigo-500 bg-indigo-900/30':'border-white/10 bg-white/5'} hover:border-indigo-400 transition`}>
                            <div>
                              <div className="text-white font-medium">{new Date(s.date).toLocaleDateString('zh-TW')}</div>
                              <div className="text-gray-300">{s.startTime} - {s.endTime}</div>
                            </div>
                            <div>
                              <select className="rounded bg-white/10 text-white px-2 py-1" defaultValue={1} onChange={e=>setValue('duration', Number(e.target.value))}>
                                {Array.from({length: maxHours}, (_,i)=>i+1).map(h=>(<option key={h} value={h}>{h} 小時</option>))}
                              </select>
                              <button className="ml-4 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={()=>onStep2(s, watch('duration')||1)}>選擇</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-6 flex justify-between">
                    <button className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700" onClick={()=>setStep(1)}>上一步</button>
                  </div>
                </div>
              )}
              {/* Step 3: 填寫資料 */}
              {step === 3 && selectedSchedule && (
                <form onSubmit={onStep3} className="space-y-6">
                  <h2 className="text-xl font-bold text-white mb-4">填寫您的資料</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">姓名</label>
                    <input type="text" {...register('name')} className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" />
                    {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">生日</label>
                    <input type="date" {...register('birthday')} className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" />
                    {errors.birthday && <p className="mt-2 text-sm text-red-400">{errors.birthday.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">電話</label>
                    <input type="tel" {...register('phone')} className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6" />
                    {errors.phone && <p className="mt-2 text-sm text-red-400">{errors.phone.message}</p>}
                  </div>
                  <div className="flex justify-between">
                    <button type="button" className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700" onClick={()=>setStep(2)}>上一步</button>
                    <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{isSubmitting?'預約中...':'完成預約'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 