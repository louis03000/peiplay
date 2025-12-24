/**
 * Schedule Service 型別定義
 */

export interface CreateScheduleInput {
  partnerId: string
  date: string
  startTime: string
  endTime: string
  isRecurring?: boolean
  recurringWeeks?: number
}

export interface CreateSchedulesBatchInput {
  partnerId: string
  schedules: Array<{
    date: string
    startTime: string
    endTime: string
  }>
}

export interface ScheduleDTO {
  id: string
  partnerId: string
  date: string
  startTime: string
  endTime: string
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

export type ScheduleServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: { type: string; message: string; details?: any } }

