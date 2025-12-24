/**
 * 統一的時間處理工具函數
 * 所有時間相關操作都必須使用台灣時區 (Asia/Taipei)
 * 
 * ⚠️ 此檔案為向後兼容層，新代碼應使用 lib/time/index.ts
 */

import {
  getNowTaipei as _getNowTaipei,
  fromDateAndTime as _fromDateAndTime,
  taipeiToUTC as _taipeiToUTC,
  formatTaipei as _formatTaipei,
  formatLocale as _formatLocale,
  addTaipeiTime as _addTaipeiTime,
  compareTaipeiTime as _compareTaipeiTime,
  dayjs,
} from './time'

const TAIWAN_TIMEZONE = 'Asia/Taipei'

/**
 * 獲取當前台灣時間的 Date 對象（UTC）
 */
export function getNowTaipei(): Date {
  return _getNowTaipei().utc().toDate()
}

/**
 * 將台灣時間字串轉換為 UTC Date 對象
 * @param dateStr 日期字串，格式: "2025-12-23"
 * @param timeStr 時間字串，格式: "10:00" 或 "10:00:00"
 * @returns UTC Date 對象
 */
export function taipeiToUTC(dateStr: string, timeStr: string): Date {
  // 標準化時間格式為 HH:mm
  const normalizedTime = timeStr.includes(':') 
    ? timeStr.split(':').slice(0, 2).join(':')
    : `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`
  
  return _taipeiToUTC(_fromDateAndTime(dateStr, normalizedTime))
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
      return _taipeiToUTC(dayjs.tz(dateTimeStr, TAIWAN_TIMEZONE))
    }
    // 如果是 "YYYY-MM-DD HH:mm:ss" 格式
    return _taipeiToUTC(dayjs.tz(dateTime, TAIWAN_TIMEZONE))
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
  return _formatTaipei(date, format)
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
  return _formatLocale(date, options)
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
  const result = _addTaipeiTime(date, amount, unit)
  return dayjs.isDayjs(result) ? result.utc().toDate() : result
}

/**
 * 比較兩個時間（台灣時間）
 * @param date1 UTC Date 對象
 * @param date2 UTC Date 對象
 * @returns 比較結果: -1 (date1 < date2), 0 (date1 === date2), 1 (date1 > date2)
 */
export function compareTaipeiTime(date1: Date, date2: Date): number {
  const diff = _compareTaipeiTime(date1, date2)
  if (diff < 0) return -1
  if (diff > 0) return 1
  return 0
}

