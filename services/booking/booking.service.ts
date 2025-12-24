/**
 * Booking Service
 * 
 * 設計原則：
 * 1. 所有 booking 相關的業務邏輯都在此
 * 2. API route 只能呼叫此 service，不能直接操作資料庫
 * 3. 禁止在此 service 中呼叫其他 service
 * 4. Transaction 必須包在 function scope 內
 */

import { PrismaClient, Prisma, BookingStatus } from '@prisma/client'
import { prisma } from '@/lib/db/client'
import { taipeiToUTC, fromISOString } from '@/lib/time'
import type { 
  CreateBookingInput, 
  CancelBookingInput, 
  RespondToBookingInput,
  BookingDTO,
  BookingServiceResult 
} from './booking.types'

// ========== 終止狀態定義 ==========
const TERMINAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.REJECTED,
  BookingStatus.PARTNER_REJECTED,
  BookingStatus.COMPLETED_WITH_AMOUNT_MISMATCH,
])

// ========== 創建預約 ==========
/**
 * 創建預約
 * 
 * ⚠️ Transaction 完全隔離在此函數內
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<BookingServiceResult<BookingDTO[]>> {
  try {
    // 在 transaction 內執行所有操作
    const result = await prisma.$transaction(async (tx) => {
      // 1. 驗證客戶存在
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      })

      if (!customer) {
        return { type: 'NO_CUSTOMER' } as const
      }

      // 2. 批量查詢時段
      const schedules = await tx.schedule.findMany({
        where: { id: { in: input.scheduleIds } },
        select: {
          id: true,
          partnerId: true,
          startTime: true,
          endTime: true,
          partner: {
            select: {
              halfHourlyRate: true,
            },
          },
        },
      })

      if (schedules.length !== input.scheduleIds.length) {
        return { type: 'INVALID_SCHEDULE' } as const
      }

      // 3. 檢查現有預約（只檢查活躍狀態）
      const existingBookings = await tx.booking.findMany({
        where: {
          scheduleId: { in: input.scheduleIds },
        },
        select: { id: true, status: true, scheduleId: true },
      })

      for (const booking of existingBookings) {
        if (!TERMINAL_STATUSES.has(booking.status)) {
          return { 
            type: 'CONFLICT',
            scheduleId: booking.scheduleId,
          } as const
        }
      }

      // 4. 創建預約
      const createdBookings = await Promise.all(
        schedules.map(async (schedule) => {
          const durationHours =
            (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60)
          const originalAmount = durationHours * schedule.partner.halfHourlyRate * 2

          return tx.booking.create({
            data: {
              customerId: input.customerId,
              partnerId: schedule.partnerId,
              scheduleId: schedule.id,
              status: BookingStatus.PAID_WAITING_PARTNER_CONFIRMATION,
              originalAmount,
              finalAmount: originalAmount,
            },
          })
        })
      )

      return { type: 'SUCCESS', bookings: createdBookings } as const
    }, {
      maxWait: 10000,
      timeout: 20000,
    })

    // 處理結果
    if (result.type === 'NO_CUSTOMER') {
      return {
        success: false,
        error: { type: 'NO_CUSTOMER', message: '客戶資料不存在' },
      }
    }

    if (result.type === 'INVALID_SCHEDULE') {
      return {
        success: false,
        error: { type: 'INVALID_SCHEDULE', message: '時段不存在' },
      }
    }

    if (result.type === 'CONFLICT') {
      return {
        success: false,
        error: {
          type: 'CONFLICT',
          message: '時段已被預約，請重新選擇其他時段',
          conflictingScheduleId: result.scheduleId,
        },
      }
    }

    // 轉換為 DTO
    const dtos: BookingDTO[] = result.bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      customerId: booking.customerId,
      partnerId: booking.partnerId,
      scheduleId: booking.scheduleId,
      startTime: booking.createdAt.toISOString(), // 實際應從 schedule 獲取
      endTime: booking.updatedAt.toISOString(), // 實際應從 schedule 獲取
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    }))

    return { success: true, data: dtos }
  } catch (error: any) {
    console.error('❌ createBooking 失敗:', error)
    
    // 處理 Prisma 錯誤
    if (error?.code === 'P2002') {
      return {
        success: false,
        error: {
          type: 'CONFLICT',
          message: '時段已被預約，請選擇其他時段',
        },
      }
    }

    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error?.message || '創建預約失敗',
      },
    }
  }
}

// ========== 取消預約 ==========
export async function cancelBooking(
  input: CancelBookingInput
): Promise<BookingServiceResult<BookingDTO>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: { customer: true },
      })

      if (!booking) {
        return { type: 'NOT_FOUND' } as const
      }

      if (booking.customerId !== input.customerId) {
        return { type: 'FORBIDDEN' } as const
      }

      if (booking.status === BookingStatus.CANCELLED) {
        return { type: 'ALREADY_CANCELLED', booking } as const
      }

      const updated = await tx.booking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.CANCELLED },
      })

      await tx.bookingCancellation.create({
        data: {
          bookingId: input.bookingId,
          customerId: input.customerId,
          reason: input.reason,
        },
      })

      return { type: 'SUCCESS', booking: updated } as const
    })

    if (result.type !== 'SUCCESS') {
      return {
        success: false,
        error: {
          type: result.type,
          message: '取消預約失敗',
        },
      }
    }

    // 轉換為 DTO（簡化版）
    const dto: BookingDTO = {
      id: result.booking.id,
      status: result.booking.status,
      customerId: result.booking.customerId,
      partnerId: result.booking.partnerId,
      scheduleId: result.booking.scheduleId,
      startTime: result.booking.createdAt.toISOString(),
      endTime: result.booking.updatedAt.toISOString(),
      createdAt: result.booking.createdAt.toISOString(),
      updatedAt: result.booking.updatedAt.toISOString(),
    }

    return { success: true, data: dto }
  } catch (error: any) {
    console.error('❌ cancelBooking 失敗:', error)
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error?.message || '取消預約失敗',
      },
    }
  }
}

// ========== 回應預約 ==========
export async function respondToBooking(
  input: RespondToBookingInput
): Promise<BookingServiceResult<BookingDTO>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: { schedule: { include: { partner: true } } },
      })

      if (!booking) {
        return { type: 'NOT_FOUND' } as const
      }

      if (booking.partnerId !== input.partnerId) {
        return { type: 'FORBIDDEN' } as const
      }

      if (input.action === 'ACCEPT') {
        const updated = await tx.booking.update({
          where: { id: input.bookingId },
          data: { status: BookingStatus.PARTNER_ACCEPTED },
        })
        return { type: 'SUCCESS', booking: updated } as const
      } else {
        if (!input.reason) {
          return { type: 'REASON_REQUIRED' } as const
        }

        const updated = await tx.booking.update({
          where: { id: input.bookingId },
          data: { 
            status: BookingStatus.PARTNER_REJECTED,
            rejectReason: input.reason,
          },
        })
        return { type: 'SUCCESS', booking: updated } as const
      }
    })

    if (result.type !== 'SUCCESS') {
      return {
        success: false,
        error: {
          type: result.type,
          message: '回應預約失敗',
        },
      }
    }

    // 轉換為 DTO（簡化版）
    const dto: BookingDTO = {
      id: result.booking.id,
      status: result.booking.status,
      customerId: result.booking.customerId,
      partnerId: result.booking.partnerId,
      scheduleId: result.booking.scheduleId,
      startTime: result.booking.createdAt.toISOString(),
      endTime: result.booking.updatedAt.toISOString(),
      createdAt: result.booking.createdAt.toISOString(),
      updatedAt: result.booking.updatedAt.toISOString(),
    }

    return { success: true, data: dto }
  } catch (error: any) {
    console.error('❌ respondToBooking 失敗:', error)
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error?.message || '回應預約失敗',
      },
    }
  }
}

