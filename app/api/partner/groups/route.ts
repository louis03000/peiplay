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
      try {
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
            // games: true, // 暫時移除，因為數據庫中可能還沒有這個字段
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
      } catch (queryError: any) {
        console.error('❌ 查詢群組預約時發生錯誤:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta,
        });
        throw queryError;
      }
    }, 'partner:groups:get')

    if (result && typeof result === 'object' && 'type' in result) {
      if (result.type === 'NOT_PARTNER') {
        return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
      }
      if (result.type === 'SUCCESS') {
        return NextResponse.json(result.groups)
      }
    }

    // 如果結果格式不正確
    console.error('❌ 結果格式不正確:', result);
    return NextResponse.json({ error: '資料庫操作失敗' }, { status: 500 })
  } catch (error) {
    console.error('❌ 獲取群組預約失敗:', error);
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
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
    
    // 詳細記錄接收到的原始資料
    console.log('🔍 接收到的原始資料:', JSON.stringify(data, null, 2))
    console.log('🔍 資料型別檢查:', {
      title: { value: data.title, type: typeof data.title },
      date: { value: data.date, type: typeof data.date },
      startTime: { value: data.startTime, type: typeof data.startTime },
      endTime: { value: data.endTime, type: typeof data.endTime },
      pricePerPerson: { value: data.pricePerPerson, type: typeof data.pricePerPerson },
      maxParticipants: { value: data.maxParticipants, type: typeof data.maxParticipants },
      games: { value: data.games, type: typeof data.games, isArray: Array.isArray(data.games) },
    })
    
    if (!data.title || !data.date || !data.startTime || !data.endTime || !data.pricePerPerson) {
      return NextResponse.json({
        error: '缺少必要欄位',
        details: '請填寫群組標題、日期、開始時間、結束時間和每人費用',
      }, { status: 400 })
    }

    // 驗證和轉換資料型別
    const title = String(data.title).trim()
    const dateStr = String(data.date).trim()
    const startTimeStr = String(data.startTime).trim()
    const endTimeStr = String(data.endTime).trim()
    
    // 確保 pricePerPerson 是數字
    const pricePerPerson = typeof data.pricePerPerson === 'number' 
      ? data.pricePerPerson 
      : parseFloat(String(data.pricePerPerson))
    
    if (isNaN(pricePerPerson) || pricePerPerson <= 0) {
      console.error('❌ pricePerPerson 無效:', data.pricePerPerson)
      return NextResponse.json({
        error: '每人費用必須是大於0的數字',
        details: `收到的值: ${data.pricePerPerson}, 型別: ${typeof data.pricePerPerson}`,
      }, { status: 400 })
    }
    
    // 確保 maxParticipants 是整數
    const maxParticipants = typeof data.maxParticipants === 'number'
      ? Math.floor(data.maxParticipants)
      : parseInt(String(data.maxParticipants || 4), 10)
    
    if (isNaN(maxParticipants) || maxParticipants < 2 || maxParticipants > 9) {
      console.error('❌ maxParticipants 無效:', data.maxParticipants)
      return NextResponse.json({
        error: '最大參與人數必須在2到9人之間',
        details: `收到的值: ${data.maxParticipants}, 型別: ${typeof data.maxParticipants}`,
      }, { status: 400 })
    }
    
    // 確保 games 是字串陣列
    let games: string[] = []
    if (Array.isArray(data.games)) {
      games = data.games
        .map((g: any) => String(g).trim())
        .filter((g: string) => g.length > 0)
        .slice(0, 10) // 最多10個
    } else if (data.games && typeof data.games === 'string') {
      // 如果是字串，嘗試分割
      games = data.games.split(',').map((g: string) => g.trim()).filter((g: string) => g.length > 0).slice(0, 10)
    }
    
    // 處理 description（可選）
    const description = data.description ? String(data.description).trim() : null

    console.log('🔍 開始創建群組預約，處理後的資料:', {
      title,
      dateStr,
      startTimeStr,
      endTimeStr,
      pricePerPerson,
      maxParticipants,
      games,
      description,
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

      // 轉換日期時間格式
      // 前端送來的格式：date = "2025-12-04", startTime = "22:00"
      // 需要組合成 ISO 格式：2025-12-04T22:00:00
      const normalizedStartTime = normalizeTime(startTimeStr)
      const normalizedEndTime = normalizeTime(endTimeStr)
      
      // 組合成完整的 ISO 日期時間字串
      const startDateTimeStr = `${dateStr}T${normalizedStartTime}`
      const endDateTimeStr = `${dateStr}T${normalizedEndTime}`
      
      console.log('🔍 日期時間組合:', {
        dateStr,
        startTimeStr,
        endTimeStr,
        normalizedStartTime,
        normalizedEndTime,
        startDateTimeStr,
        endDateTimeStr,
      })
      
      // 創建 Date 對象
      const startTime = new Date(startDateTimeStr)
      const endTime = new Date(endDateTimeStr)
      
      console.log('🔍 創建的 Date 對象:', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        startTimeValid: !isNaN(startTime.getTime()),
        endTimeValid: !isNaN(endTime.getTime()),
      })

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        console.error('❌ 日期時間格式錯誤:', {
          startDateTimeStr,
          endDateTimeStr,
          startTime: startTime.toString(),
          endTime: endTime.toString(),
        })
        return { type: 'INVALID_DATETIME' } as const
      }

      if (endTime <= startTime) {
        console.error('❌ 結束時間必須晚於開始時間:', {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
        return { type: 'END_BEFORE_START' } as const
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
              console.log('🔍 創建客戶記錄，userId:', session.user.id)
              customer = await tx.customer.create({
                data: {
                  id: `customer-${session.user.id}`,
                  userId: session.user.id,
                  name: user.name || '未知客戶',
                  birthday: new Date('1990-01-01'),
                  phone: '0000000000',
                },
              })
              console.log('✅ 客戶記錄創建成功，customerId:', customer.id)
            } catch (error: any) {
              console.error('⚠️ 創建客戶記錄失敗，錯誤代碼:', error?.code)
              console.error('錯誤詳情:', {
                message: error?.message,
                code: error?.code,
                meta: error?.meta,
              })
              // 如果創建失敗（可能是並發創建），再次查詢
              if (error?.code === 'P2002') {
                console.log('⚠️ 檢測到重複鍵錯誤，嘗試再次查詢客戶記錄...')
                customer = await tx.customer.findUnique({ where: { userId: session.user.id } })
                if (customer) {
                  console.log('✅ 成功找到客戶記錄（並發創建）')
                }
              }
              if (!customer) {
                console.error('❌ 無法創建或找到客戶記錄')
                throw new Error(`無法創建客戶記錄: ${error?.message || '未知錯誤'}`)
              }
            }
          } else {
            console.log('✅ 找到現有客戶記錄，customerId:', customer.id)
          }

          // 生成唯一的群組預約ID
          const groupBookingId = `gb-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
          console.log('🔍 生成群組預約ID:', groupBookingId)

          // 創建群組預約
          // 注意：暫時不包含 games 字段，因為數據庫中可能還沒有這個字段
          const createData: any = {
            id: groupBookingId,
            type: 'PARTNER_INITIATED' as const,
            title: title || null,
            description: description || null,
            date: startTime, // DateTime
            startTime: startTime, // DateTime
            endTime: endTime, // DateTime
            maxParticipants: maxParticipants, // Int
            currentParticipants: 0, // Int
            pricePerPerson: pricePerPerson, // Float
            status: 'ACTIVE' as const,
            initiatorId: partner.id, // String
            initiatorType: 'PARTNER', // String
            // games: games, // 暫時移除，因為數據庫中可能還沒有這個字段
          }
          
          // 如果數據庫有 games 字段，可以添加
          // 暫時註釋掉，等數據庫遷移完成後再啟用
          // if (games.length > 0) {
          //   createData.games = games
          // }
          
          console.log('🔍 準備創建群組預約，Prisma 資料:', {
            ...createData,
            date: createData.date.toISOString(),
            startTime: createData.startTime.toISOString(),
            endTime: createData.endTime.toISOString(),
          })
          console.log('🔍 資料型別驗證:', {
            id: typeof createData.id,
            type: typeof createData.type,
            title: typeof createData.title,
            description: typeof createData.description,
            date: createData.date instanceof Date,
            startTime: createData.startTime instanceof Date,
            endTime: createData.endTime instanceof Date,
            maxParticipants: typeof createData.maxParticipants,
            currentParticipants: typeof createData.currentParticipants,
            pricePerPerson: typeof createData.pricePerPerson,
            status: typeof createData.status,
            initiatorId: typeof createData.initiatorId,
            initiatorType: typeof createData.initiatorType,
            // games: Array.isArray(createData.games), // 暫時移除，因為數據庫中可能還沒有這個字段
          })
          
          let groupBooking
          try {
            groupBooking = await tx.groupBooking.create({
              data: createData,
            })
            console.log('✅ 群組預約創建成功:', groupBooking.id)
          } catch (createError: any) {
            console.error('❌ 創建群組預約失敗 - Prisma 錯誤:', {
              code: createError?.code,
              message: createError?.message,
              meta: createError?.meta,
              name: createError?.name,
              stack: createError?.stack,
            })
            console.error('❌ 嘗試創建的資料:', JSON.stringify(createData, null, 2))
            
            // 如果是 Prisma 驗證錯誤，提供更詳細的錯誤訊息
            if (createError?.code === 'P2009' || createError?.code === 'P2012') {
              console.error('❌ Prisma 驗證錯誤詳情:', {
                code: createError.code,
                message: createError.message,
                meta: createError.meta,
              })
            }
            
            throw createError
          }

          // 創建群組參與者記錄
          console.log('🔍 創建群組參與者記錄，資料:', {
            id: `gbp-${groupBooking.id}-${partner.id}`,
            groupBookingId: groupBooking.id,
            customerId: customer.id,
            partnerId: partner.id,
          })
          try {
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
          } catch (participantError: any) {
            console.error('❌ 創建群組參與者記錄失敗:', {
              code: participantError?.code,
              message: participantError?.message,
              meta: participantError?.meta,
            })
            throw participantError
          }

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
              games: (groupBooking as any).games || [], // 暫時使用類型斷言，因為數據庫中可能還沒有這個字段
              startTime: groupBooking.startTime.toISOString(),
              endTime: groupBooking.endTime.toISOString(),
            },
          }
        }, {
          maxWait: 10000, // 等待事務開始的最大時間（10秒）
          timeout: 20000, // 事務執行的最大時間（20秒）
        })

        console.log('✅ 事務完成，結果:', transactionResult)
        if (!transactionResult || typeof transactionResult !== 'object' || !('type' in transactionResult)) {
          console.error('❌ 事務返回了無效的結果:', transactionResult)
          throw new Error('事務返回了無效的結果格式')
        }
        return transactionResult
      } catch (transactionError: any) {
        console.error('❌ 事務執行失敗:', transactionError)
        console.error('錯誤詳情:', {
          message: transactionError?.message,
          code: transactionError?.code,
          meta: transactionError?.meta,
          stack: transactionError?.stack,
          name: transactionError?.name,
        })
        // 如果是重複鍵錯誤，返回 DUPLICATE
        if (transactionError?.code === 'P2002') {
          console.log('⚠️ 檢測到重複鍵錯誤，返回 DUPLICATE')
          return { type: 'DUPLICATE' } as const
        }
        // 如果是連接超時或連接錯誤，返回特定錯誤類型
        if (transactionError?.code === 'P1001' || transactionError?.code === 'P1002' || 
            transactionError?.code === 'P1008' || transactionError?.code === 'P1017' ||
            transactionError?.code === 'P2024') {
          console.error('❌ 資料庫連接超時')
          throw new Error('資料庫連接超時，請稍後再試')
        }
        // 其他錯誤直接拋出，讓外層 catch 處理
        throw transactionError
      }
    }, 'partner:groups:post')

    // 記錄結果以便調試
    console.log('🔍 db.query 返回結果:', {
      result,
      resultType: typeof result,
      hasType: result && typeof result === 'object' && 'type' in result,
      resultKeys: result && typeof result === 'object' ? Object.keys(result) : [],
    })

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
          console.error('❌ 未知的結果類型:', result.type)
          return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
      }
    }

    // 如果結果格式不正確，返回錯誤（這不應該發生，但我們需要處理它）
    console.error('❌ 結果格式不正確:', {
      result,
      resultType: typeof result,
      isNull: result === null,
      isUndefined: result === undefined,
    })
    return NextResponse.json({ 
      error: '資料庫操作失敗',
      details: '結果格式不正確，請檢查伺服器日誌',
    }, { status: 500 })
  } catch (error) {
    console.error('❌ 創建群組預約失敗 - 外層 catch:', error)
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    
    // 如果是 Prisma 錯誤，提供更詳細的錯誤訊息
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any
      console.error('❌ Prisma 錯誤代碼:', prismaError.code)
      console.error('❌ Prisma 錯誤訊息:', prismaError.message)
      console.error('❌ Prisma 錯誤 meta:', JSON.stringify(prismaError.meta, null, 2))
      
      // 根據錯誤代碼返回更詳細的錯誤訊息
      if (prismaError.code === 'P2009') {
        return NextResponse.json({
          error: '資料型別不符合',
          details: prismaError.message,
          code: prismaError.code,
        }, { status: 400 })
      }
      if (prismaError.code === 'P2012') {
        return NextResponse.json({
          error: '缺少必填欄位',
          details: prismaError.message,
          code: prismaError.code,
        }, { status: 400 })
      }
      if (prismaError.code === 'P2002') {
        return NextResponse.json({
          error: '資料已存在',
          details: prismaError.message,
          code: prismaError.code,
        }, { status: 409 })
      }
    }
    
    return createErrorResponse(error, 'partner:groups:post')
  }
}

function normalizeTime(value: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`無效的時間格式: ${value}`)
  }
  
  // 處理 ISO 格式：2025-12-04T22:00:00 或 2025-12-04T22:00:00Z
  if (value.includes('T')) {
    const timePart = value.split('T')[1]?.split('Z')[0]?.split('+')[0]
    value = timePart || value
  }
  
  // 處理 "上午 10:00" 或 "下午 22:00" 格式
  if (value.includes('上午') || value.includes('下午')) {
    const isPM = value.includes('下午')
    const timeMatch = value.match(/(\d{1,2}):(\d{2})/)
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10)
      const minute = timeMatch[2]
      if (isPM && hour !== 12) {
        hour += 12
      } else if (!isPM && hour === 12) {
        hour = 0
      }
      value = `${String(hour).padStart(2, '0')}:${minute}`
    }
  }
  
  // 處理標準時間格式：HH:MM
  const parts = value.split(':')
  if (parts.length === 2) {
    const hour = parseInt(parts[0], 10)
    const minute = parseInt(parts[1], 10)
    
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error(`無效的時間格式: ${value}`)
    }
    
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  }
  
  // 如果已經是完整格式（HH:MM:SS），直接返回
  if (parts.length === 3) {
    return value
  }
  
  throw new Error(`無法解析的時間格式: ${value}`)
}