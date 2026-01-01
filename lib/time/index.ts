/**
 * 統一的時間處理工具
 * 
 * 設計原則：
 * 1. 所有時間建立只能從此檔案 import
 * 2. 禁止直接 new Date()
 * 3. 禁止各自使用 dayjs.extend
 * 4. DB 儲存：UTC
 * 5. API 回傳：ISO string
 * 6. 前端顯示：由前端處理 timezone
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 初始化 dayjs 插件（只初始化一次）
dayjs.extend(utc)
dayjs.extend(timezone)

// ========== 時區配置 ==========
const TAIWAN_TIMEZONE = 'Asia/Taipei'

// ========== 時間建立 ==========
/**
 * 獲取當前時間（台灣時區）
 * 
 * ⚠️ 禁止直接使用 new Date()，必須使用此函數
 */
export function getNowTaipei(): dayjs.Dayjs {
  const result = dayjs.tz(TAIWAN_TIMEZONE)
  // 驗證結果是否有效
  if (!result.isValid()) {
    throw new Error(`getNowTaipei returned invalid dayjs object: ${result.format()}`);
  }
  return result
}

/**
 * 從 ISO 字符串建立時間（台灣時區）
 */
export function fromISOString(isoString: string): dayjs.Dayjs {
  return dayjs.tz(isoString, TAIWAN_TIMEZONE)
}

/**
 * 從日期和時間字符串建立時間（台灣時區）
 * @param dateStr 日期字符串，格式：YYYY-MM-DD
 * @param timeStr 時間字符串，格式：HH:mm
 */
export function fromDateAndTime(dateStr: string, timeStr: string): dayjs.Dayjs {
  return dayjs.tz(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm', TAIWAN_TIMEZONE)
}

// ========== 時間轉換 ==========
/**
 * 將台灣時區時間轉換為 UTC Date（用於資料庫儲存）
 */
export function taipeiToUTC(date: dayjs.Dayjs | Date | string): Date {
  const d = typeof date === 'string' 
    ? dayjs.tz(date, TAIWAN_TIMEZONE)
    : dayjs.isDayjs(date)
    ? date
    : dayjs.tz(date, TAIWAN_TIMEZONE)
  
  return d.utc().toDate()
}

/**
 * 將 UTC Date 轉換為台灣時區的 dayjs 對象
 */
export function utcToTaipei(date: Date | string): dayjs.Dayjs {
  return dayjs.utc(date).tz(TAIWAN_TIMEZONE)
}

// ========== 時間格式化 ==========
/**
 * 格式化為 ISO 字符串（用於 API 回傳）
 */
export function toISOString(date: dayjs.Dayjs | Date | string): string {
  const d = typeof date === 'string'
    ? dayjs(date)
    : dayjs.isDayjs(date)
    ? date
    : dayjs(date)
  
  return d.toISOString()
}

/**
 * 格式化為台灣時區的本地字符串
 */
export function formatTaipei(
  date: dayjs.Dayjs | Date | string,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string {
  const d = typeof date === 'string'
    ? dayjs.tz(date, TAIWAN_TIMEZONE)
    : dayjs.isDayjs(date)
    ? date.tz(TAIWAN_TIMEZONE)
    : dayjs.tz(date, TAIWAN_TIMEZONE)
  
  return d.format(format)
}

/**
 * 格式化為本地時間字符串（使用 Intl API）
 */
export function formatLocale(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-TW', {
    timeZone: TAIWAN_TIMEZONE,
    ...options,
  })
}

// ========== 時間運算 ==========
/**
 * 在台灣時區中添加時間
 */
export function addTaipeiTime(
  date: dayjs.Dayjs | Date | string,
  amount: number,
  unit: dayjs.ManipulateType
): dayjs.Dayjs {
  let d: dayjs.Dayjs;
  
  if (typeof date === 'string') {
    d = dayjs.tz(date, TAIWAN_TIMEZONE);
  } else if (dayjs.isDayjs(date)) {
    d = date;
  } else {
    // 驗證 Date 對象是否有效
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error(`Invalid Date object provided to addTaipeiTime: ${date}`);
    }
    d = dayjs.tz(date, TAIWAN_TIMEZONE);
  }
  
  // 驗證 dayjs 對象是否有效
  if (!d.isValid()) {
    throw new Error(`Invalid dayjs object created from date: ${date}, result: ${d.format()}`);
  }
  
  const result = d.add(amount, unit);
  
  // 驗證結果是否有效
  if (!result.isValid()) {
    throw new Error(`addTaipeiTime result is invalid: input=${date}, amount=${amount}, unit=${unit}, result=${result.format()}`);
  }
  
  return result;
}

/**
 * 比較兩個時間（台灣時區）
 */
export function compareTaipeiTime(
  date1: dayjs.Dayjs | Date | string,
  date2: dayjs.Dayjs | Date | string,
  unit: dayjs.UnitType = 'second'
): number {
  const d1 = typeof date1 === 'string'
    ? dayjs.tz(date1, TAIWAN_TIMEZONE)
    : dayjs.isDayjs(date1)
    ? date1
    : dayjs.tz(date1, TAIWAN_TIMEZONE)
  
  const d2 = typeof date2 === 'string'
    ? dayjs.tz(date2, TAIWAN_TIMEZONE)
    : dayjs.isDayjs(date2)
    ? date2
    : dayjs.tz(date2, TAIWAN_TIMEZONE)
  
  return d1.diff(d2, unit)
}

// ========== 時間解析（向後兼容）==========
/**
 * 解析日期和時間字符串（台灣時區）並轉換為 UTC Date
 * 
 * @deprecated 使用 fromDateAndTime + taipeiToUTC 代替
 */
export function parseTaipeiDateTime(dateStr: string, timeStr: string): Date {
  return taipeiToUTC(fromDateAndTime(dateStr, timeStr))
}

// ========== 導出 dayjs（僅供內部使用）==========
/**
 * ⚠️ 警告：此導出僅供內部使用
 * 外部模組應使用此檔案提供的函數，而非直接使用 dayjs
 */
export { dayjs }

