import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
// ⚠️ API 層不使用時區轉換，直接使用 Date 對象（UTC）

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
        
        // ⚠️ 查詢該夥伴的所有時段，檢查時間重疊 - 不依賴 date 字段
        // 因為台灣時間轉換為 UTC 可能會跨日，date 字段可能不一致但時間實際重疊
        // 使用 startTime 的日期範圍來查詢
        const timeRange = schedules.reduce((acc, s) => {
          const start = new Date(s.startTime)
          if (!acc.min || start < acc.min) acc.min = start
          if (!acc.max || start > acc.max) acc.max = start
          return acc
        }, { min: null as Date | null, max: null as Date | null })

        if (!timeRange.min || !timeRange.max) {
          return { type: 'INVALID_BODY' } as const
        }

        // 擴展查詢範圍，包括前一天和後一天（因為跨日時段）
        const queryStart = new Date(timeRange.min)
        queryStart.setUTCHours(0, 0, 0, 0)
        queryStart.setUTCDate(queryStart.getUTCDate() - 1)
        const queryEnd = new Date(timeRange.max)
        queryEnd.setUTCHours(23, 59, 59, 999)
        queryEnd.setUTCDate(queryEnd.getUTCDate() + 1)

        // 查詢該時間範圍內的所有時段（使用 startTime 而不是 date）
        const allSchedules = await client.schedule.findMany({
          where: {
            partnerId: partner.id,
            startTime: {
              gte: queryStart,
              lte: queryEnd,
            },
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        })

        console.log(`🔍 找到 ${allSchedules.length} 個現有時段在時間範圍內`)

        // 檢查是否有重複（完全匹配或時間重疊）
        // ⚠️ API 層：直接使用 Date，不做時區轉換，所有時間都是 UTC
        // ⚠️ 重要：不依賴 date 字段比較，直接比較 startTime/endTime 的時間重疊
        // 因為台灣時間轉換為 UTC 可能會跨日，導致 date 字段不一致但時間實際重疊
        const duplicates: any[] = []
        for (const newSchedule of schedules) {
          const newStart = new Date(newSchedule.startTime)
          const newEnd = new Date(newSchedule.endTime)

          console.log(`🔍 POST: 檢查新時段 (UTC):`, {
            original: { date: newSchedule.date, startTime: newSchedule.startTime, endTime: newSchedule.endTime },
            parsed: { 
              startTime: newStart.toISOString(), 
              endTime: newEnd.toISOString() 
            },
          })

          for (const existing of allSchedules) {
            // ⚠️ 直接比較時間重疊，不依賴 date 字段
            // 因為台灣時間轉換為 UTC 可能會跨日，date 字段可能不一致但時間實際重疊
            const existingStart = new Date(existing.startTime)
            const existingEnd = new Date(existing.endTime)
            
            // 時間重疊：新時段的開始時間 < 現有時段的結束時間 且 新時段的結束時間 > 現有時段的開始時間
            // ⚠️ 所有時間都是 UTC，直接比較
            if (newStart.getTime() < existingEnd.getTime() && newEnd.getTime() > existingStart.getTime()) {
              duplicates.push({
                existing,
                new: { date: newSchedule.date, startTime: newSchedule.startTime, endTime: newSchedule.endTime },
              })
              console.log(`❌ 發現重複時段: 現有 ${existing.id} (date: ${existing.date.toISOString()}, ${existingStart.toISOString()}-${existingEnd.toISOString()}) vs 新增 (date: ${newSchedule.date}, ${newStart.toISOString()}-${newEnd.toISOString()})`)
              break
            }
          }
        }

        if (duplicates.length > 0) {
          return { type: 'DUPLICATED', details: duplicates } as const
        }

        // ⚠️ API 層：直接使用 Date，不做時區轉換
        const created = await client.schedule.createMany({
          data: schedules.map((s) => ({
            partnerId: partner.id,
            date: new Date(s.date),
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
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

      // ⚠️ API 層：直接使用 Date，不做時區轉換
      const newDate = new Date(date)
      const newStart = new Date(startTime)
      const newEnd = new Date(endTime)

      console.log(`🔍 檢查單一時段是否重複 (UTC): date=${newDate.toISOString()}, ${newStart.toISOString()}-${newEnd.toISOString()}`)

      // ⚠️ 查詢該夥伴的所有時段，檢查時間重疊 - 不依賴 date 字段
      // 因為台灣時間轉換為 UTC 可能會跨日，date 字段可能不一致但時間實際重疊
      // 使用 startTime 的日期範圍來查詢，但最終比較時只比較時間重疊
      const dayStart = new Date(newStart)
      dayStart.setUTCHours(0, 0, 0, 0)
      const dayEnd = new Date(newStart)
      dayEnd.setUTCHours(23, 59, 59, 999)
      // 也檢查前一天和後一天，因為跨日時段可能在前一天或後一天
      const prevDayStart = new Date(dayStart)
      prevDayStart.setUTCDate(prevDayStart.getUTCDate() - 1)
      const nextDayEnd = new Date(dayEnd)
      nextDayEnd.setUTCDate(nextDayEnd.getUTCDate() + 1)

      const existingSchedules = await client.schedule.findMany({
        where: {
          partnerId: partner.id,
          startTime: {
            gte: prevDayStart,
            lte: nextDayEnd,
          },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
        },
      })

      console.log(`🔍 找到 ${existingSchedules.length} 個相關時間範圍的現有時段`)

      // 檢查是否有時間重疊（不依賴 date 字段）
      for (const existing of existingSchedules) {
        const existingStart = new Date(existing.startTime)
        const existingEnd = new Date(existing.endTime)
        
        // 時間重疊檢查
        if (newStart.getTime() < existingEnd.getTime() && newEnd.getTime() > existingStart.getTime()) {
          console.log(`❌ 發現重複時段: 現有 ${existing.id} (date: ${existing.date.toISOString()}, ${existingStart.toISOString()}-${existingEnd.toISOString()}) vs 新增 (date: ${newDate.toISOString()}, ${newStart.toISOString()}-${newEnd.toISOString()})`)
          return { type: 'DUPLICATED', details: [existing] } as const
        }
      }

      // ⚠️ API 層：直接使用 Date，不做時區轉換
      const schedule = await client.schedule.create({
        data: {
          partnerId: partner.id,
          date: new Date(date),
          startTime: new Date(startTime),
          endTime: new Date(endTime),
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
        // ⚠️ 錯誤訊息：將 UTC 時間正確轉換為台灣時間顯示
        const errorMessage = result.details && Array.isArray(result.details) && result.details.length > 0
          ? `以下時段與現有時段重疊，無法新增：${result.details.map((d: any) => {
              const existing = d.existing || d
              const existingStart = new Date(existing.startTime)
              const existingEnd = new Date(existing.endTime)
              
              // 使用 Intl.DateTimeFormat 明確指定台灣時區
              const formatter = new Intl.DateTimeFormat('zh-TW', {
                timeZone: 'Asia/Taipei',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
              
              return `${formatter.format(existingStart)}-${formatter.format(existingEnd)}`
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
        console.log('❌ DELETE: 請求格式錯誤 - 不是陣列或為空')
        return { type: 'INVALID_BODY', reason: '請傳入要刪除的時段陣列' } as const
      }

      // 驗證每個時段都有必要的字段
      const invalidSchedules = payload.filter(s => !s.date || !s.startTime || !s.endTime)
      if (invalidSchedules.length > 0) {
        console.log('❌ DELETE: 請求格式錯誤 - 缺少必要字段:', invalidSchedules)
        return { type: 'INVALID_BODY', reason: '時段數據缺少必要字段 (date, startTime, endTime)' } as const
      }

      console.log(`🔍 DELETE: 收到 ${payload.length} 個要刪除的時段請求`)
      console.log(`🔍 DELETE: 請求內容:`, payload.map(s => ({
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
      })))

      // ⚠️ API 層：直接使用 Date，不做時區轉換
      // 前端發送的是 ISO 字符串（已經是 UTC），直接轉換為 Date
      const scheduleConditions = payload.map((s) => {
        const date = new Date(s.date)
        const startTime = new Date(s.startTime)
        const endTime = new Date(s.endTime)
        
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

      // ⚠️ API 層：直接使用 Date，不做時區轉換
      // 在應用層進行精確匹配（允許 1 分鐘的誤差）
      const matchedSchedules = allSchedules.filter(schedule => {
        return payload.some((req) => {
          // 前端發送的是 ISO 字符串（已經是 UTC），直接轉換為 Date
          const reqDate = new Date(req.date)
          const reqStartTime = new Date(req.startTime)
          const reqEndTime = new Date(req.endTime)
          
          // 比較日期（只比較年月日，忽略時間）- 使用 UTC
          const scheduleDate = new Date(schedule.date)
          scheduleDate.setUTCHours(0, 0, 0, 0)
          const reqDateOnly = new Date(reqDate)
          reqDateOnly.setUTCHours(0, 0, 0, 0)
          
          if (scheduleDate.getTime() !== reqDateOnly.getTime()) {
            return false
          }
          
          // 比較時間（允許 1 分鐘的誤差）- 所有時間都是 UTC
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

      // 刪除 schedule 時，只檢查是否有活躍的 booking（CONFIRMED 或 PENDING）
      // 如果有，則不能刪除；否則可以刪除
      const deletable = schedules.filter((s) => {
        // 如果沒有 booking，可以刪除
        if (!s.bookings) {
          return true
        }
        // 如果有 booking，但狀態是終端狀態（CANCELLED, REJECTED, COMPLETED），可以刪除
        const status = String(s.bookings.status)
        const terminalStatuses = ['CANCELLED', 'REJECTED', 'COMPLETED', 'COMPLETED_WITH_AMOUNT_MISMATCH']
        if (terminalStatuses.includes(status)) {
          return true
        }
        // 如果是活躍狀態（CONFIRMED, PENDING），不能刪除
        return false
      })

      console.log(`🔍 DELETE: 可刪除的時段: ${deletable.length}/${schedules.length}`)
      if (deletable.length === 0) {
        const hasBookings = schedules.some(s => s.bookings)
        if (hasBookings) {
          return { type: 'NO_DELETABLE', reason: '時段已被預約，無法刪除' } as const
        }
        return { type: 'NO_DELETABLE', reason: '找不到匹配的時段' } as const
      }

      const ids = deletable.map((s) => s.id)
      const deleted = await client.schedule.deleteMany({ where: { id: { in: ids } } })

      return { type: 'SUCCESS', count: deleted.count }
    }, 'partner:schedule:delete')

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
      case 'INVALID_BODY':
        const errorMsg = result.reason || '請傳入要刪除的時段陣列'
        console.log('❌ DELETE: 返回 400 錯誤:', errorMsg)
        return NextResponse.json({ error: errorMsg }, { status: 400 })
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