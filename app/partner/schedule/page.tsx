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
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [searchDate, setSearchDate] = useState('')
  const [exportDateRange, setExportDateRange] = useState({
    startDate: '',
    endDate: '',
  })
  const [isExporting, setIsExporting] = useState(false)
  const [stats, setStats] = useState<ScheduleStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoadingReminders, setIsLoadingReminders] = useState(false)
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([])
  const [isBatchUpdating, setIsBatchUpdating] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      isRecurring: false,
      recurringWeeks: 1,
    },
  })

  const isRecurring = watch('isRecurring')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (status === 'authenticated') {
      fetchSchedules()
      fetchStats()
      fetchReminders()
    }
  }, [status, router])

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/schedules')
      if (!response.ok) {
        throw new Error('獲取時段失敗')
      }
      const data = await response.json()
      setSchedules(data)
    } catch (error) {
      console.error('Error fetching schedules:', error)
    }
  }

  const fetchStats = async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch('/api/schedules/stats?weeks=4')
      if (!response.ok) {
        throw new Error('獲取統計數據失敗')
      }
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  const fetchReminders = async () => {
    setIsLoadingReminders(true)
    try {
      const response = await fetch('/api/schedules/reminders')
      if (!response.ok) {
        throw new Error('獲取提醒失敗')
      }
      const data = await response.json()
      setReminders(data.reminders)
    } catch (error) {
      console.error('Error fetching reminders:', error)
    } finally {
      setIsLoadingReminders(false)
    }
  }

  const onSubmit = async (data: ScheduleFormData) => {
    setIsLoading(true)
    try {
      const url = editingSchedule
        ? `/api/schedules?id=${editingSchedule.id}`
        : '/api/schedules'
      const method = editingSchedule ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '操作失敗')
      }

      await fetchSchedules()
      reset()
      setEditingSchedule(null)
    } catch (error) {
      console.error('Error saving schedule:', error)
      alert(error instanceof Error ? error.message : '操作失敗')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('確定要刪除這個時段嗎？')) {
      return
    }

    try {
      const response = await fetch(`/api/schedules?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('刪除時段失敗')
      }

      await fetchSchedules()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('刪除時段失敗')
    }
  }

  const handleEditSchedule = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setValue('date', schedule.date)
    setValue('startTime', schedule.startTime)
    setValue('endTime', schedule.endTime)
    setValue('isRecurring', schedule.isRecurring || false)
    setValue('recurringWeeks', schedule.recurringWeeks || 1)
  }

  const handleCancelEdit = () => {
    setEditingSchedule(null)
    reset()
  }

  const handleExport = async () => {
    if (!exportDateRange.startDate || !exportDateRange.endDate) {
      alert('請選擇匯出日期範圍')
      return
    }

    setIsExporting(true)
    try {
      const response = await fetch(
        `/api/schedules/export?startDate=${exportDateRange.startDate}&endDate=${exportDateRange.endDate}&format=csv`
      )

      if (!response.ok) {
        throw new Error('匯出失敗')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `schedules-${format(new Date(), 'yyyyMMdd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting schedules:', error)
      alert('匯出失敗')
    } finally {
      setIsExporting(false)
    }
  }

  const updateReminderStatus = async (
    scheduleId: string,
    bookingId: string,
    reminderSent: boolean
  ) => {
    try {
      const response = await fetch('/api/schedules/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduleId,
          bookingId,
          reminderSent,
        }),
      })

      if (!response.ok) {
        throw new Error('更新提醒狀態失敗')
      }

      await fetchReminders()
    } catch (error) {
      console.error('Error updating reminder status:', error)
      alert('更新提醒狀態失敗')
    }
  }

  const handleSelectSchedule = (id: string) => {
    setSelectedSchedules((prev) =>
      prev.includes(id)
        ? prev.filter((scheduleId) => scheduleId !== id)
        : [...prev, id]
    )
  }

  const handleBatchDelete = async () => {
    if (!selectedSchedules.length) {
      alert('請選擇要刪除的時段')
      return
    }

    if (!confirm('確定要刪除選中的時段嗎？')) {
      return
    }

    try {
      const response = await fetch('/api/schedules/batch', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedSchedules }),
      })

      if (!response.ok) {
        throw new Error('批量刪除失敗')
      }

      await fetchSchedules()
      setSelectedSchedules([])
    } catch (error) {
      console.error('Error batch deleting schedules:', error)
      alert('批量刪除失敗')
    }
  }

  const handleBatchUpdateStatus = async (isAvailable: boolean) => {
    if (!selectedSchedules.length) {
      alert('請選擇要更新的時段')
      return
    }

    setIsBatchUpdating(true)
    try {
      const response = await fetch('/api/schedules/batch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: selectedSchedules,
          isAvailable,
        }),
      })

      if (!response.ok) {
        throw new Error('批量更新失敗')
      }

      await fetchSchedules()
      setSelectedSchedules([])
    } catch (error) {
      console.error('Error batch updating schedules:', error)
      alert('批量更新失敗')
    } finally {
      setIsBatchUpdating(false)
    }
  }

  const filteredSchedules = searchDate
    ? schedules.filter((schedule) => schedule.date === searchDate)
    : schedules

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            時段管理
          </h1>
          <p className="mt-3 text-xl text-gray-300">
            設置您的可用時段
          </p>
        </div>

        <div className="mt-12">
          <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="date"
                      className="block text-sm font-medium text-gray-300"
                    >
                      日期
                    </label>
                    <div className="mt-1">
                      <input
                        type="date"
                        {...register('date')}
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                      />
                      {errors.date && (
                        <p className="mt-2 text-sm text-red-400">
                          {errors.date.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="startTime"
                      className="block text-sm font-medium text-gray-300"
                    >
                      開始時間
                    </label>
                    <div className="mt-1">
                      <input
                        type="time"
                        {...register('startTime')}
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                      />
                      {errors.startTime && (
                        <p className="mt-2 text-sm text-red-400">
                          {errors.startTime.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="endTime"
                      className="block text-sm font-medium text-gray-300"
                    >
                      結束時間
                    </label>
                    <div className="mt-1">
                      <input
                        type="time"
                        {...register('endTime')}
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                      />
                      {errors.endTime && (
                        <p className="mt-2 text-sm text-red-400">
                          {errors.endTime.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isRecurring')}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label className="ml-2 block text-sm text-gray-300">
                      重複設置
                    </label>
                  </div>

                  {isRecurring && (
                    <div>
                      <label
                        htmlFor="recurringWeeks"
                        className="block text-sm font-medium text-gray-300"
                      >
                        重複週數
                      </label>
                      <div className="mt-1">
                        <input
                          type="number"
                          min="1"
                          max="12"
                          {...register('recurringWeeks', { valueAsNumber: true })}
                          className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                        />
                        {errors.recurringWeeks && (
                          <p className="mt-2 text-sm text-red-400">
                            {errors.recurringWeeks.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading
                      ? '處理中...'
                      : editingSchedule
                      ? '更新時段'
                      : '新增時段'}
                  </button>
                  {editingSchedule && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-300 bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                    >
                      取消
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    已設置的時段
                  </h2>
                  <div className="flex space-x-4">
                    <div className="flex space-x-2">
                      <input
                        type="date"
                        value={exportDateRange.startDate}
                        onChange={(e) =>
                          setExportDateRange((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                      />
                      <input
                        type="date"
                        value={exportDateRange.endDate}
                        onChange={(e) =>
                          setExportDateRange((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                      />
                      <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExporting ? '匯出中...' : '匯出 CSV'}
                      </button>
                    </div>
                    <div>
                      <input
                        type="date"
                        value={searchDate}
                        onChange={(e) => setSearchDate(e.target.value)}
                        className="block w-full rounded-lg border-0 bg-white/5 px-4 py-2 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      checked={selectedSchedules.length === filteredSchedules.length && filteredSchedules.length > 0}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedSchedules(filteredSchedules.map(s => s.id))
                        } else {
                          setSelectedSchedules([])
                        }
                      }}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-gray-300">全選</span>
                    <button
                      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      disabled={selectedSchedules.length === 0 || isBatchUpdating}
                      onClick={handleBatchDelete}
                    >
                      批量刪除
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      disabled={selectedSchedules.length === 0 || isBatchUpdating}
                      onClick={() => handleBatchUpdateStatus(true)}
                    >
                      批量開放
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
                      disabled={selectedSchedules.length === 0 || isBatchUpdating}
                      onClick={() => handleBatchUpdateStatus(false)}
                    >
                      批量關閉
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={handleExport}
                      disabled={isExporting}
                    >
                      匯出 CSV
                    </button>
                  </div>
                  {filteredSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedSchedules.includes(schedule.id)}
                          onChange={() => handleSelectSchedule(schedule.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="text-white">
                          <p className="font-medium">
                            {format(new Date(schedule.date), 'yyyy年MM月dd日', {
                              locale: zhTW,
                            })}
                          </p>
                          <p className="text-gray-300">
                            {schedule.startTime} - {schedule.endTime}
                          </p>
                          {schedule.isRecurring && (
                            <p className="text-sm text-indigo-400">
                              重複設置（{schedule.recurringWeeks}週）
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditSchedule(schedule)}
                          className="text-indigo-400 hover:text-indigo-300"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredSchedules.length === 0 && (
                    <p className="text-gray-300 text-center">
                      尚未設置任何時段
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  統計分析
                </h2>

                {isLoadingStats ? (
                  <div className="text-center text-gray-300">載入中...</div>
                ) : stats ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-300">
                          總時段數
                        </h3>
                        <p className="mt-2 text-3xl font-bold text-white">
                          {stats.overallStats.totalSlots}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-300">
                          已預約時段
                        </h3>
                        <p className="mt-2 text-3xl font-bold text-white">
                          {stats.overallStats.bookedSlots}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-300">
                          使用率
                        </h3>
                        <p className="mt-2 text-3xl font-bold text-white">
                          {stats.overallStats.utilizationRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-300 mb-4">
                        熱門時段
                      </h3>
                      <div className="space-y-2">
                        {stats.popularTimeSlots.map((slot) => (
                          <div
                            key={slot.timeSlot}
                            className="flex justify-between items-center"
                          >
                            <span className="text-white">{slot.timeSlot}</span>
                            <span className="text-indigo-400">
                              {slot.count} 次
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-300 mb-4">
                        每週使用率
                      </h3>
                      <div className="space-y-4">
                        {stats.weeklyStats.map((week) => (
                          <div key={week.week}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white">
                                第 {week.week} 週
                              </span>
                              <span className="text-indigo-400">
                                {week.utilizationRate.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{
                                  width: `${week.utilizationRate}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-300">
                    無法載入統計數據
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white/10 backdrop-blur-lg shadow-xl rounded-2xl border border-white/20">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  即將到來的預約
                </h2>

                {isLoadingReminders ? (
                  <div className="text-center text-gray-300">載入中...</div>
                ) : reminders.length > 0 ? (
                  <div className="space-y-4">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.bookingId}
                        className="bg-white/5 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium text-white">
                              {reminder.customerName}
                            </h3>
                            <p className="text-gray-300">
                              {format(new Date(reminder.date), 'yyyy年MM月dd日', {
                                locale: zhTW,
                              })}
                            </p>
                            <p className="text-gray-300">
                              {reminder.startTime} - {reminder.endTime}
                            </p>
                            <p className="text-indigo-400">
                              距離開始還有 {reminder.hoursUntilStart} 小時
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <a
                              href={`tel:${reminder.customerPhone}`}
                              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
                            >
                              撥打電話
                            </a>
                            <button
                              onClick={() =>
                                updateReminderStatus(
                                  reminder.scheduleId,
                                  reminder.bookingId,
                                  true
                                )
                              }
                              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                            >
                              已提醒
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-300">
                    未來 24 小時內沒有預約
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 