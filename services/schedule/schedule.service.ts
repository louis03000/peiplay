/**
 * Schedule Service
 * 
 * 設計原則：
 * 1. 所有 schedule 相關的業務邏輯都在此
 * 2. API route 只能呼叫此 service，不能直接操作資料庫
 * 3. Transaction 必須包在 function scope 內
 */

import { prisma } from '@/lib/db/client'
import { parseTaipeiDateTime, addTaipeiTime } from '@/lib/time-utils'
import type { 
  CreateScheduleInput,
  CreateSchedulesBatchInput,
  ScheduleDTO,
  ScheduleServiceResult 
} from './schedule.types'

/**
 * 檢查時間重疊
 */
function hasTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1.getTime() < end2.getTime() && start2.getTime() < end1.getTime()
}

/**
 * 創建單一時段
 */
export async function createSchedule(
  input: CreateScheduleInput
): Promise<ScheduleServiceResult<ScheduleDTO>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 驗證夥伴存在
      const partner = await tx.partner.findUnique({
        where: { id: input.partnerId },
        select: { id: true },
      })

      if (!partner) {
        return { type: 'NO_PARTNER' } as const
      }

      // 解析時間
      const scheduleDate = parseTaipeiDateTime(input.date)
      const startTime = parseTaipeiDateTime(input.startTime)
      const endTime = parseTaipeiDateTime(input.endTime)

      if (Number.isNaN(scheduleDate.getTime()) || 
          Number.isNaN(startTime.getTime()) || 
          Number.isNaN(endTime.getTime())) {
        return { type: 'INVALID_DATE' } as const
      }

      // 檢查時間衝突
      const dayStart = new Date(scheduleDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(scheduleDate)
      dayEnd.setHours(23, 59, 59, 999)

      const existingSchedules = await tx.schedule.findMany({
        where: {
          partnerId: input.partnerId,
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
        },
      })

      // 檢查是否有時間重疊
      for (const existing of existingSchedules) {
        if (hasTimeOverlap(
          startTime,
          endTime,
          new Date(existing.startTime),
          new Date(existing.endTime)
        )) {
          return { 
            type: 'CONFLICT',
            existingScheduleId: existing.id,
          } as const
        }
      }

      // 創建時段
      const baseSchedule = await tx.schedule.create({
        data: {
          partnerId: input.partnerId,
          date: scheduleDate,
          startTime,
          endTime,
          isAvailable: true,
        },
      })

      // 處理重複時段
      if (input.isRecurring && input.recurringWeeks && input.recurringWeeks > 1) {
        const entries = []
        for (let i = 1; i < input.recurringWeeks; i++) {
          const nextDate = addTaipeiTime(scheduleDate, i * 7, 'day')
          entries.push({
            partnerId: input.partnerId,
            date: nextDate,
            startTime,
            endTime,
            isAvailable: true,
          })
        }

        if (entries.length > 0) {
          await tx.schedule.createMany({ 
            data: entries,
            skipDuplicates: true,
          })
        }
      }

      return { type: 'SUCCESS', schedule: baseSchedule } as const
    })

    if (result.type !== 'SUCCESS') {
      const errorMessages: Record<string, string> = {
        NO_PARTNER: '找不到夥伴信息',
        INVALID_DATE: '日期格式錯誤',
        CONFLICT: '時段與現有時段衝突',
      }

      return {
        success: false,
        error: {
          type: result.type,
          message: errorMessages[result.type] || '創建時段失敗',
          ...(result.type === 'CONFLICT' && 'existingScheduleId' in result 
            ? { details: { existingScheduleId: result.existingScheduleId } } 
            : {}),
        },
      }
    }

    // 轉換為 DTO
    const dto: ScheduleDTO = {
      id: result.schedule.id,
      partnerId: result.schedule.partnerId,
      date: result.schedule.date.toISOString(),
      startTime: result.schedule.startTime.toISOString(),
      endTime: result.schedule.endTime.toISOString(),
      isAvailable: result.schedule.isAvailable,
      createdAt: result.schedule.createdAt.toISOString(),
      updatedAt: result.schedule.updatedAt.toISOString(),
    }

    return { success: true, data: dto }
  } catch (error: any) {
    console.error('❌ createSchedule 失敗:', error)
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error?.message || '創建時段失敗',
      },
    }
  }
}

/**
 * 批量創建時段
 */
export async function createSchedulesBatch(
  input: CreateSchedulesBatchInput
): Promise<ScheduleServiceResult<{ count: number }>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 驗證夥伴存在
      const partner = await tx.partner.findUnique({
        where: { id: input.partnerId },
        select: { id: true },
      })

      if (!partner) {
        return { type: 'NO_PARTNER' } as const
      }

      // 過濾有效時段
      const validSchedules = input.schedules.filter(
        (s) => s?.date && s?.startTime && s?.endTime
      )

      if (validSchedules.length === 0) {
        return { type: 'INVALID_BODY' } as const
      }

      // 計算日期範圍
      const dateRange = validSchedules.reduce(
        (acc, s) => {
          const date = parseTaipeiDateTime(s.date)
          if (!acc.min || date < acc.min) acc.min = date
          if (!acc.max || date > acc.max) acc.max = date
          return acc
        },
        { min: null as Date | null, max: null as Date | null }
      )

      if (!dateRange.min || !dateRange.max) {
        return { type: 'INVALID_BODY' } as const
      }

      // 查詢現有時段
      const allSchedules = await tx.schedule.findMany({
        where: {
          partnerId: input.partnerId,
          date: {
            gte: dateRange.min,
            lte: dateRange.max,
          },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
        },
      })

      // 檢查重複
      const duplicates: any[] = []
      for (const newSchedule of validSchedules) {
        const newDate = parseTaipeiDateTime(newSchedule.date)
        const newStart = parseTaipeiDateTime(newSchedule.startTime)
        const newEnd = parseTaipeiDateTime(newSchedule.endTime)

        for (const existing of allSchedules) {
          const existingDate = new Date(existing.date)
          const existingStart = new Date(existing.startTime)
          const existingEnd = new Date(existing.endTime)

          // 檢查日期和時間是否重疊
          if (
            newDate.toDateString() === existingDate.toDateString() &&
            hasTimeOverlap(newStart, newEnd, existingStart, existingEnd)
          ) {
            duplicates.push({
              existing,
              new: newSchedule,
            })
            break
          }
        }
      }

      if (duplicates.length > 0) {
        return { type: 'DUPLICATED', details: duplicates } as const
      }

      // 創建時段
      const created = await tx.schedule.createMany({
        data: validSchedules.map((s) => ({
          partnerId: input.partnerId,
          date: parseTaipeiDateTime(s.date),
          startTime: parseTaipeiDateTime(s.startTime),
          endTime: parseTaipeiDateTime(s.endTime),
          isAvailable: true,
        })),
        skipDuplicates: true,
      })

      return { type: 'SUCCESS', count: created.count } as const
    })

    if (result.type !== 'SUCCESS') {
      const errorMessages: Record<string, string> = {
        NO_PARTNER: '找不到夥伴信息',
        INVALID_BODY: '沒有有效的時段數據',
        DUPLICATED: '時段與現有時段重疊',
      }

      return {
        success: false,
        error: {
          type: result.type,
          message: errorMessages[result.type] || '批量創建時段失敗',
          ...(result.type === 'DUPLICATED' && 'details' in result
            ? { details: result.details }
            : {}),
        },
      }
    }

    return { success: true, data: { count: result.count } }
  } catch (error: any) {
    console.error('❌ createSchedulesBatch 失敗:', error)
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error?.message || '批量創建時段失敗',
      },
    }
  }
}

