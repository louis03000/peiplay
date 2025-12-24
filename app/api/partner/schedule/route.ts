import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { parseTaipeiDateTime } from '@/lib/time-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const payload = await request.json()

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      if (Array.isArray(payload)) {
        const schedules = payload.filter((s) => s?.date && s?.startTime && s?.endTime)
        if (schedules.length === 0) {
          return { type: 'INVALID_BODY' } as const
        }

        console.log(`🔍 檢查 ${schedules.length} 個時段是否重複...`)
        
        // 先查詢該夥伴在相關日期範圍內的所有時段
        const dateRange = schedules.reduce((acc, s) => {
          const date = parseTaipeiDateTime(s.date)
          if (!acc.min || date < acc.min) acc.min = date
          if (!acc.max || date > acc.max) acc.max = date
          return acc
        }, { min: null as Date | null, max: null as Date | null })

        if (!dateRange.min || !dateRange.max) {
          return { type: 'INVALID_BODY' } as const
        }

        // 查詢該日期範圍內的所有時段
        const allSchedules = await client.schedule.findMany({
          where: {
            partnerId: partner.id,
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

        console.log(`🔍 找到 ${allSchedules.length} 個現有時段在日期範圍內`)

        // 檢查是否有重複（完全匹配或時間重疊）
        const duplicates: any[] = []
        for (const newSchedule of schedules) {
          const newDate = parseTaipeiDateTime(newSchedule.date)
          const newStart = parseTaipeiDateTime(newSchedule.startTime)
          const newEnd = parseTaipeiDateTime(newSchedule.endTime)

          for (const existing of allSchedules) {
            // 檢查是否同一天
            const existingDate = new Date(existing.date)
            existingDate.setHours(0, 0, 0, 0)
            const newDateOnly = new Date(newDate)
            newDateOnly.setHours(0, 0, 0, 0)
            
            if (existingDate.getTime() === newDateOnly.getTime()) {
              // 同一天，檢查時間是否重疊
              const existingStart = new Date(existing.startTime)
              const existingEnd = new Date(existing.endTime)
              
              // 時間重疊：新時段的開始時間 < 現有時段的結束時間 且 新時段的結束時間 > 現有時段的開始時間
              if (newStart.getTime() < existingEnd.getTime() && newEnd.getTime() > existingStart.getTime()) {
                duplicates.push({
                  existing,
                  new: { date: newSchedule.date, startTime: newSchedule.startTime, endTime: newSchedule.endTime },
                })
                console.log(`❌ 發現重複時段: 現有 ${existing.id} (${existing.date.toISOString()} ${existingStart.toISOString()}-${existingEnd.toISOString()}) vs 新增 (${newDate.toISOString()} ${newStart.toISOString()}-${newEnd.toISOString()})`)
                break
              }
            }
          }
        }

        if (duplicates.length > 0) {
          return { type: 'DUPLICATED', details: duplicates } as const
        }

        const created = await client.schedule.createMany({
          data: schedules.map((s) => ({
            partnerId: partner.id,
            date: parseTaipeiDateTime(s.date),
            startTime: parseTaipeiDateTime(s.startTime),
            endTime: parseTaipeiDateTime(s.endTime),
            isAvailable: true,
          })),
          skipDuplicates: true,
        })

        return { type: 'BATCH_SUCCESS', count: created.count } as const
      }

      const { date, startTime, endTime } = payload
      if (!date || !startTime || !endTime) {
        return { type: 'INVALID_BODY' } as const
      }

      const newDate = parseTaipeiDateTime(date)
      const newStart = parseTaipeiDateTime(startTime)
      const newEnd = parseTaipeiDateTime(endTime)

      console.log(`🔍 檢查單一時段是否重複: ${newDate.toISOString()} ${newStart.toISOString()}-${newEnd.toISOString()}`)

      // 查詢同一天的所有時段，檢查時間重疊
      const dayStart = new Date(newDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(newDate)
      dayEnd.setHours(23, 59, 59, 999)

      const existingSchedules = await client.schedule.findMany({
        where: {
          partnerId: partner.id,
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
        },
      })

      console.log(`🔍 找到 ${existingSchedules.length} 個同一天的現有時段`)

      // 檢查是否有時間重疊
      for (const existing of existingSchedules) {
        const existingStart = new Date(existing.startTime)
        const existingEnd = new Date(existing.endTime)
        
        // 時間重疊檢查
        if (newStart.getTime() < existingEnd.getTime() && newEnd.getTime() > existingStart.getTime()) {
          console.log(`❌ 發現重複時段: 現有 ${existing.id} (${existingStart.toISOString()}-${existingEnd.toISOString()}) vs 新增 (${newStart.toISOString()}-${newEnd.toISOString()})`)
          return { type: 'DUPLICATED', details: [existing] } as const
        }
      }

      const schedule = await client.schedule.create({
        data: {
          partnerId: partner.id,
          date: parseTaipeiDateTime(date),
          startTime: parseTaipeiDateTime(startTime),
          endTime: parseTaipeiDateTime(endTime),
          isAvailable: true,
        },
      })

      return { type: 'SINGLE_SUCCESS', schedule } as const
    }, 'partner:schedule:create')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
      case 'INVALID_BODY':
        return NextResponse.json({ error: '沒有有效的時段數據' }, { status: 400 })
      case 'DUPLICATED':
        const errorMessage = result.details && Array.isArray(result.details) && result.details.length > 0
          ? `以下時段與現有時段重疊，無法新增：${result.details.map((d: any) => {
              const existing = d.existing || d
              const existingStart = new Date(existing.startTime)
              const existingEnd = new Date(existing.endTime)
              return `${existingStart.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}-${existingEnd.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
            }).join(', ')}`
          : '該時段已存在或與現有時段重疊，不可重複新增'
        return NextResponse.json({ error: errorMessage, details: result.details }, { status: 409 })
      case 'BATCH_SUCCESS':
        return NextResponse.json({ success: true, count: result.count })
      case 'SINGLE_SUCCESS':
        return NextResponse.json(result.schedule)
      default:
        return NextResponse.json({ error: '未知狀態' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partner:schedule:create')
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          schedules: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              isAvailable: true,
              bookings: {
                select: { status: true },
              },
            },
            orderBy: { date: 'asc' },
          },
        },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const schedules = partner.schedules.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable,
        booked: Boolean(s.bookings?.status && !['CANCELLED', 'REJECTED'].includes(s.bookings.status as string)),
      }))

      return { type: 'SUCCESS', schedules } as const
    }, 'partner:schedule:get')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    return NextResponse.json(result.schedules)
  } catch (error) {
    return createErrorResponse(error, 'partner:schedule:get')
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const payload = await request.json()

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      if (!Array.isArray(payload) || payload.length === 0) {
        return { type: 'INVALID_BODY' } as const
      }

      console.log(`🔍 DELETE: 收到 ${payload.length} 個要刪除的時段請求`)
      console.log(`🔍 DELETE: 請求內容:`, payload.map(s => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      })))

      // 前端發送的是 ISO 字符串（從 API 返回的），需要轉換為 Date 對象
      // 但要注意：如果前端發送的是 ISO 字符串，它已經是 UTC 時間
      // 如果前端發送的是日期字符串（如 "2025-12-25"），需要通過 parseTaipeiDateTime 解析
      const scheduleConditions = payload.map((s) => {
        // 判斷是 ISO 字符串還是日期字符串
        const dateStr = String(s.date)
        const startTimeStr = String(s.startTime)
        const endTimeStr = String(s.endTime)
        
        // 如果是 ISO 字符串（包含 'T' 或 'Z'），直接轉換為 Date
        // 否則使用 parseTaipeiDateTime 解析（假設是台灣時區）
        const date = dateStr.includes('T') || dateStr.includes('Z') 
          ? new Date(dateStr)
          : parseTaipeiDateTime(dateStr)
        const startTime = startTimeStr.includes('T') || startTimeStr.includes('Z')
          ? new Date(startTimeStr)
          : parseTaipeiDateTime(startTimeStr)
        const endTime = endTimeStr.includes('T') || endTimeStr.includes('Z')
          ? new Date(endTimeStr)
          : parseTaipeiDateTime(endTimeStr)
        
        console.log(`🔍 DELETE: 解析後的時間:`, {
          original: { date: s.date, startTime: s.startTime, endTime: s.endTime },
          parsed: { 
            date: date.toISOString(), 
            startTime: startTime.toISOString(), 
            endTime: endTime.toISOString() 
          },
        })
        
        return {
          AND: [
            { date: { equals: date } },
            { startTime: { equals: startTime } },
            { endTime: { equals: endTime } },
          ],
        }
      })

      // 先查詢該夥伴的所有時段，然後在應用層進行精確匹配
      // 這樣可以避免 Prisma 的 Date 比較精度問題
      const allSchedules = await client.schedule.findMany({
        where: {
          partnerId: partner.id,
        },
        include: { bookings: true },
      })

      console.log(`🔍 DELETE: 查詢到 ${allSchedules.length} 個夥伴的所有時段`)

      // 在應用層進行精確匹配（允許 1 分鐘的誤差）
      const matchedSchedules = allSchedules.filter(schedule => {
        return payload.some((req) => {
          const dateStr = String(req.date)
          const startTimeStr = String(req.startTime)
          const endTimeStr = String(req.endTime)
          
          const reqDate = dateStr.includes('T') || dateStr.includes('Z') 
            ? new Date(dateStr)
            : parseTaipeiDateTime(dateStr)
          const reqStartTime = startTimeStr.includes('T') || startTimeStr.includes('Z')
            ? new Date(startTimeStr)
            : parseTaipeiDateTime(startTimeStr)
          const reqEndTime = endTimeStr.includes('T') || endTimeStr.includes('Z')
            ? new Date(endTimeStr)
            : parseTaipeiDateTime(endTimeStr)
          
          // 比較日期（只比較年月日，忽略時間）
          const scheduleDate = new Date(schedule.date)
          scheduleDate.setHours(0, 0, 0, 0)
          const reqDateOnly = new Date(reqDate)
          reqDateOnly.setHours(0, 0, 0, 0)
          
          if (scheduleDate.getTime() !== reqDateOnly.getTime()) {
            return false
          }
          
          // 比較時間（允許 1 分鐘的誤差）
          const scheduleStart = new Date(schedule.startTime).getTime()
          const scheduleEnd = new Date(schedule.endTime).getTime()
          const reqStart = reqStartTime.getTime()
          const reqEnd = reqEndTime.getTime()
          
          const startDiff = Math.abs(scheduleStart - reqStart)
          const endDiff = Math.abs(scheduleEnd - reqEnd)
          
          return startDiff <= 60 * 1000 && endDiff <= 60 * 1000 // 允許 1 分鐘誤差
        })
      })

      console.log(`🔍 DELETE: 找到 ${matchedSchedules.length} 個匹配的時段`)
      if (matchedSchedules.length > 0) {
        console.log(`🔍 DELETE: 匹配的時段詳情:`, matchedSchedules.map(s => ({
          id: s.id,
          date: s.date.toISOString(),
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString(),
          hasBooking: !!s.bookings,
          bookingStatus: s.bookings?.status,
        })))
      }

      const schedules = matchedSchedules

      const deletable = schedules.filter(
        (s) => !s.bookings || !['CONFIRMED', 'PENDING'].includes(String(s.bookings.status))
      )

      if (deletable.length === 0) {
        return { type: 'NO_DELETABLE' } as const
      }

      const ids = deletable.map((s) => s.id)
      const deleted = await client.schedule.deleteMany({ where: { id: { in: ids } } })

      return { type: 'SUCCESS', count: deleted.count }
    }, 'partner:schedule:delete')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
      case 'INVALID_BODY':
        return NextResponse.json({ error: '請傳入要刪除的時段陣列' }, { status: 400 })
      case 'NO_DELETABLE':
        return NextResponse.json({ error: '沒有可刪除的時段（可能已被預約）' }, { status: 409 })
      case 'SUCCESS':
        return NextResponse.json({ success: true, count: result.count })
      default:
        return NextResponse.json({ error: '未知狀態' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partner:schedule:delete')
  }
} 