/**
 * 統一的時間處理工具函數
 * 所有時間相關操作都必須使用台灣時區 (Asia/Taipei)
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const TAIWAN_TIMEZONE = 'Asia/Taipei'

/**
 * 獲取當前台灣時間的 Date 對象（UTC）
 */
export function getNowTaipei(): Date {
  return dayjs().tz(TAIWAN_TIMEZONE).utc().toDate()
}

/**
 * 將台灣時間字串轉換為 UTC Date 對象
 * @param dateStr 日期字串，格式: "2025-12-23"
 * @param timeStr 時間字串，格式: "10:00" 或 "10:00:00"
 * @returns UTC Date 對象
 */
export function taipeiToUTC(dateStr: string, timeStr: string): Date {
  // 標準化時間格式為 HH:mm:ss
  const normalizedTime = timeStr.includes(':') 
    ? (timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr)
    : `${timeStr.slice(0, 2)}:${timeStr.slice(2)}:00`
  
  const dateTimeStr = `${dateStr} ${normalizedTime}`
  return dayjs.tz(dateTimeStr, TAIWAN_TIMEZONE).utc().toDate()
}

/**
 * 將 ISO 字串或 Date 對象轉換為台灣時間的 Date 對象（UTC）
 * @param dateTime ISO 字串或 Date 對象
 * @returns UTC Date 對象（代表台灣時間）
 */
export function parseTaipeiDateTime(dateTime: string | Date): Date {
  if (typeof dateTime === 'string') {
    // 如果是 ISO 字串，假設它是台灣時間
    if (dateTime.includes('T')) {
      // 移除時區信息，假設為台灣時間
      const dateTimeStr = dateTime.replace(/[Z+-].*$/, '')
      return dayjs.tz(dateTimeStr, TAIWAN_TIMEZONE).utc().toDate()
    }
    // 如果是 "YYYY-MM-DD HH:mm:ss" 格式
    return dayjs.tz(dateTime, TAIWAN_TIMEZONE).utc().toDate()
  }
  // 如果是 Date 對象，假設它已經是 UTC，直接返回
  return dateTime
}

/**
 * 將 UTC Date 對象格式化為台灣時間字串
 * @param date UTC Date 對象
 * @param format 格式字串，預設: "YYYY-MM-DD HH:mm:ss"
 * @returns 台灣時間字串
 */
export function formatTaipeiTime(date: Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs.utc(date).tz(TAIWAN_TIMEZONE).format(format)
}

/**
 * 將 UTC Date 對象格式化為台灣時間的本地化字串
 * @param date UTC Date 對象
 * @param options Intl.DateTimeFormatOptions
 * @returns 本地化時間字串
 */
export function formatTaipeiLocale(
  date: Date, 
  options: Intl.DateTimeFormatOptions = { 
    timeZone: TAIWAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  return new Date(date).toLocaleString('zh-TW', options)
}

/**
 * 檢查時間是否在台灣時區的指定範圍內
 * @param date UTC Date 對象
 * @param startTime 開始時間（台灣時間字串，格式: "HH:mm"）
 * @param endTime 結束時間（台灣時間字串，格式: "HH:mm"）
 * @param dateStr 日期字串，格式: "YYYY-MM-DD"（可選，預設為今天）
 * @returns 是否在範圍內
 */
export function isTimeInRange(
  date: Date,
  startTime: string,
  endTime: string,
  dateStr?: string
): boolean {
  const targetDate = dateStr || formatTaipeiTime(date, 'YYYY-MM-DD')
  const start = taipeiToUTC(targetDate, startTime)
  const end = taipeiToUTC(targetDate, endTime)
  
  // 處理跨日情況
  if (end.getTime() < start.getTime()) {
    const nextDay = dayjs.tz(`${targetDate} ${startTime}`, TAIWAN_TIMEZONE).add(1, 'day').format('YYYY-MM-DD')
    const endNextDay = taipeiToUTC(nextDay, endTime)
    return date.getTime() >= start.getTime() && date.getTime() <= endNextDay.getTime()
  }
  
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

/**
 * 在台灣時間基礎上添加指定時間
 * @param date UTC Date 對象（代表台灣時間）
 * @param amount 數量
 * @param unit 單位: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
 * @returns 新的 UTC Date 對象
 */
export function addTaipeiTime(
  date: Date,
  amount: number,
  unit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
): Date {
  return dayjs.utc(date).tz(TAIWAN_TIMEZONE).add(amount, unit).utc().toDate()
}

/**
 * 比較兩個時間（台灣時間）
 * @param date1 UTC Date 對象
 * @param date2 UTC Date 對象
 * @returns 比較結果: -1 (date1 < date2), 0 (date1 === date2), 1 (date1 > date2)
 */
export function compareTaipeiTime(date1: Date, date2: Date): number {
  const time1 = date1.getTime()
  const time2 = date2.getTime()
  if (time1 < time2) return -1
  if (time1 > time2) return 1
  return 0
}

