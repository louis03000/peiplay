/**
 * Booking Service 型別定義
 * 
 * 設計原則：
 * 1. 此檔案僅供 booking service 使用
 * 2. 其他 service 不可 import 此檔案
 * 3. 共用型別放在 /types/shared
 */

import { BookingStatus } from '@prisma/client'

// ========== 輸入型別 ==========
export interface CreateBookingInput {
  scheduleIds: string[]
  customerId: string
}

export interface CancelBookingInput {
  bookingId: string
  customerId: string
  reason: string
}

export interface RespondToBookingInput {
  bookingId: string
  partnerId: string
  action: 'ACCEPT' | 'REJECT'
  reason?: string
}

// ========== 輸出型別（DTO）==========
export interface BookingDTO {
  id: string
  status: BookingStatus
  customerId: string
  partnerId: string
  scheduleId: string
  startTime: string
  endTime: string
  createdAt: string
  updatedAt: string
}

export interface BookingConflictError {
  type: 'CONFLICT'
  message: string
  conflictingScheduleId?: string
}

// ========== Service 結果型別 ==========
export type BookingServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: BookingConflictError | { type: string; message: string } }

