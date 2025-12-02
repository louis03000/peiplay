import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const groupBookings = await client.groupBooking.findMany({
        where: {
          initiatorId: partner.id,
          initiatorType: 'PARTNER',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          description: true,
          maxParticipants: true,
          pricePerPerson: true,
          status: true,
          games: true,
          startTime: true,
          endTime: true,
          _count: {
            select: { GroupBookingParticipant: true },
          },
        },
        orderBy: { startTime: 'asc' },
      })

      const groups = groupBookings.map((group) => ({
        id: group.id,
        title: group.title,
        description: group.description,
        maxParticipants: group.maxParticipants,
        currentParticipants: group._count.GroupBookingParticipant,
        pricePerPerson: group.pricePerPerson,
        status: group.status,
        games: group.games || [],
        startTime: group.startTime instanceof Date ? group.startTime.toISOString() : group.startTime,
        endTime: group.endTime instanceof Date ? group.endTime.toISOString() : group.endTime,
      }))

      return { type: 'SUCCESS', groups }
    }, 'partner:groups:get')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
    }

    return NextResponse.json(result.groups)
  } catch (error) {
    return createErrorResponse(error, 'partner:groups:get')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const data = await request.json()
    if (!data.title || !data.date || !data.startTime || !data.endTime || !data.pricePerPerson) {
      return NextResponse.json({
        error: '缺少必要欄位',
        details: '請填寫群組標題、日期、開始時間、結束時間和每人費用',
      }, { status: 400 })
    }

    console.log('🔍 開始創建群組預約，資料:', {
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      pricePerPerson: data.pricePerPerson,
      maxParticipants: data.maxParticipants,
      games: data.games,
    })

    const result = await db.query(async (client) => {
      console.log('🔍 查詢夥伴資料...')
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        console.log('❌ 找不到夥伴資料')
        return { type: 'NOT_PARTNER' } as const
      }

      console.log('🔍 查詢用戶資料...')
      const user = await client.user.findUnique({ where: { id: session.user.id } })
      if (!user) {
        console.log('❌ 找不到用戶資料')
        return { type: 'USER_NOT_FOUND' } as const
      }

      const startTime = new Date(`${data.date}T${normalizeTime(data.startTime)}`)
      const endTime = new Date(`${data.date}T${normalizeTime(data.endTime)}`)

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        console.log('❌ 日期時間格式錯誤')
        return { type: 'INVALID_DATETIME' } as const
      }

      if (endTime <= startTime) {
        console.log('❌ 結束時間必須晚於開始時間')
        return { type: 'END_BEFORE_START' } as const
      }

      if (data.pricePerPerson <= 0) {
        console.log('❌ 每人費用必須大於0')
        return { type: 'INVALID_PRICE' } as const
      }

      const maxParticipants = data.maxParticipants || 4
      if (maxParticipants < 2 || maxParticipants > 9) {
        console.log('❌ 最大參與人數必須在2到9人之間')
        return { type: 'INVALID_PARTICIPANTS' } as const
      }

      console.log('🔍 開始事務...')
      try {
        // 使用事務確保所有操作的原子性
        const transactionResult = await client.$transaction(async (tx) => {
          console.log('🔍 查找或創建客戶記錄...')
          // 查找或創建客戶記錄
          let customer = await tx.customer.findUnique({ where: { userId: session.user.id } })
          if (!customer) {
            try {
              console.log('🔍 創建客戶記錄...')
              customer = await tx.customer.create({
                data: {
                  id: `customer-${session.user.id}`,
                  userId: session.user.id,
                  name: user.name || '未知客戶',
                  birthday: new Date('1990-01-01'),
                  phone: '0000000000',
                },
              })
              console.log('✅ 客戶記錄創建成功')
            } catch (error: any) {
              console.log('⚠️ 創建客戶記錄失敗，嘗試再次查詢...', error?.code)
              // 如果創建失敗（可能是並發創建），再次查詢
              if (error?.code === 'P2002') {
                customer = await tx.customer.findUnique({ where: { userId: session.user.id } })
              }
              if (!customer) {
                throw error
              }
            }
          }

          // 生成唯一的群組預約ID
          const groupBookingId = `gb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          console.log('🔍 生成群組預約ID:', groupBookingId)

          // 創建群組預約
          console.log('🔍 創建群組預約...')
          const groupBooking = await tx.groupBooking.create({
            data: {
              id: groupBookingId,
              type: 'PARTNER_INITIATED',
              title: data.title.trim(),
              description: data.description ? data.description.trim() : null,
              date: startTime,
              startTime,
              endTime,
              maxParticipants,
              currentParticipants: 0,
              pricePerPerson: parseFloat(data.pricePerPerson),
              status: 'ACTIVE',
              initiatorId: partner.id,
              initiatorType: 'PARTNER',
              games: Array.isArray(data.games) ? data.games.filter((g: any) => g && typeof g === 'string') : [],
            },
          })
          console.log('✅ 群組預約創建成功:', groupBooking.id)

          // 創建群組參與者記錄
          console.log('🔍 創建群組參與者記錄...')
          await tx.groupBookingParticipant.create({
            data: {
              id: `gbp-${groupBooking.id}-${partner.id}`,
              groupBookingId: groupBooking.id,
              customerId: customer.id,
              partnerId: partner.id,
              status: 'ACTIVE',
            },
          })
          console.log('✅ 群組參與者記錄創建成功')

          // 更新群組預約的當前參與人數
          console.log('🔍 更新群組預約參與人數...')
          await tx.groupBooking.update({
            where: { id: groupBooking.id },
            data: { currentParticipants: 1 },
          })

          // 確保夥伴的 allowGroupBooking 狀態為 true
          console.log('🔍 更新夥伴設定...')
          await tx.partner.update({
            where: { id: partner.id },
            data: { allowGroupBooking: true },
          })

          return {
            type: 'SUCCESS',
            group: {
              id: groupBooking.id,
              title: groupBooking.title,
              description: groupBooking.description,
              maxParticipants: groupBooking.maxParticipants,
              currentParticipants: 1,
              pricePerPerson: groupBooking.pricePerPerson,
              status: groupBooking.status,
              games: groupBooking.games || [],
              startTime: groupBooking.startTime.toISOString(),
              endTime: groupBooking.endTime.toISOString(),
            },
          }
        }, {
          maxWait: 10000, // 等待事務開始的最大時間（10秒）
          timeout: 20000, // 事務執行的最大時間（20秒）
        })

        console.log('✅ 事務完成')
        return transactionResult
      } catch (transactionError: any) {
        console.error('❌ 事務執行失敗:', transactionError)
        console.error('錯誤詳情:', {
          message: transactionError?.message,
          code: transactionError?.code,
          meta: transactionError?.meta,
        })
        // 如果是重複鍵錯誤，返回 DUPLICATE
        if (transactionError?.code === 'P2002') {
          return { type: 'DUPLICATE' } as const
        }
        // 其他錯誤直接拋出，讓外層 catch 處理
        throw transactionError
      }
    }, 'partner:groups:post')

    // 檢查結果類型
    if (result && typeof result === 'object' && 'type' in result) {
      switch (result.type) {
        case 'NOT_PARTNER':
          return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
        case 'USER_NOT_FOUND':
          return NextResponse.json({ error: '用戶資料不存在' }, { status: 404 })
        case 'CUSTOMER_CREATE_FAILED':
          return NextResponse.json({ error: '無法創建客戶記錄' }, { status: 500 })
        case 'INVALID_DATETIME':
          return NextResponse.json({ error: '日期時間格式錯誤' }, { status: 400 })
        case 'END_BEFORE_START':
          return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
        case 'INVALID_PRICE':
          return NextResponse.json({ error: '每人費用必須大於0' }, { status: 400 })
        case 'INVALID_PARTICIPANTS':
          return NextResponse.json({ error: '最大參與人數必須在2到9人之間' }, { status: 400 })
        case 'DUPLICATE':
          return NextResponse.json({ error: '群組預約ID已存在，請稍後再試' }, { status: 409 })
        case 'SUCCESS':
          return NextResponse.json({ success: true, groupBooking: result.group })
        default:
          return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
      }
    }

    // 如果結果格式不正確，返回錯誤
    return NextResponse.json({ error: '資料庫操作失敗' }, { status: 500 })
  } catch (error) {
    console.error('❌ 創建群組預約失敗:', error)
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    return createErrorResponse(error, 'partner:groups:post')
  }
}

function normalizeTime(value: string) {
  if (value.includes('T')) {
    const timePart = value.split('T')[1]?.split('Z')[0]?.split('+')[0]
    value = timePart || value
  }
  const parts = value.split(':')
  if (parts.length === 2) {
    return `${value}:00`
  }
  return value
}