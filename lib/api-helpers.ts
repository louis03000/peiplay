import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from './db-resilience'

/**
 * API 錯誤處理和響應工具
 */

export interface ApiError {
  message: string
  code?: string
  statusCode: number
  details?: any
}

/**
 * 標準化錯誤響應
 */
export function createErrorResponse(error: unknown, context?: string): NextResponse {
  console.error(`❌ API Error${context ? ` [${context}]` : ''}:`, error)
  
  // 詳細記錄錯誤資訊
  if (error && typeof error === 'object') {
    const errorObj = error as any
    console.error('🔍 錯誤詳情:', {
      code: errorObj?.code,
      message: errorObj?.message,
      meta: errorObj?.meta,
      name: errorObj?.name,
      stack: errorObj?.stack,
    })
  }

  // Prisma 錯誤處理
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error, context)
  }

  // Prisma 初始化錯誤
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error: '資料庫連接失敗，請稍後再試',
        code: 'DB_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 503 }
    )
  }

  // Prisma 驗證錯誤
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error: '資料驗證失敗',
        code: 'VALIDATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 400 }
    )
  }

  // 斷路器錯誤
  if (error instanceof Error && error.message.includes('Circuit breaker is OPEN')) {
    return NextResponse.json(
      {
        error: '資料庫服務暫時無法使用，請稍後再試',
        code: 'SERVICE_UNAVAILABLE',
        retryAfter: 60, // 建議60秒後重試
      },
      { 
        status: 503,
        headers: {
          'Retry-After': '60',
        }
      }
    )
  }

  // 一般錯誤
  const isDevelopment = process.env.NODE_ENV === 'development'
  const errorMessage = error instanceof Error ? error.message : '發生未知錯誤'
  
  // 🔥 檢查錯誤訊息，如果是時段已被預約的錯誤，返回 409 狀態碼和更具體的錯誤訊息
  const isConflictError = errorMessage.includes('時段已被預約') || 
                         errorMessage.includes('已被預約') ||
                         errorMessage.includes('時間有衝突') ||
                         errorMessage.includes('時間衝突')
  
  // 如果是衝突錯誤，返回更具體的錯誤訊息
  if (isConflictError) {
    return NextResponse.json(
      {
        error: errorMessage, // 使用原始錯誤訊息
        code: 'CONFLICT_ERROR',
        details: isDevelopment ? errorMessage : undefined,
      },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      error: isDevelopment ? errorMessage : '伺服器錯誤，請稍後再試',
      code: 'INTERNAL_ERROR',
      details: isDevelopment ? errorMessage : undefined,
    },
    { status: 500 }
  )
}

/**
 * 處理 Prisma 特定錯誤
 */
function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  context?: string
): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development'

  switch (error.code) {
    // 唯一性約束違反
    case 'P2002':
      return NextResponse.json(
        {
          error: '資料已存在',
          code: 'DUPLICATE_ENTRY',
          field: (error.meta?.target as string[])?.join(', '),
          details: isDevelopment ? error.message : undefined,
        },
        { status: 409 }
      )

    // 找不到記錄
    case 'P2025':
      return NextResponse.json(
        {
          error: '找不到指定的資料',
          code: 'NOT_FOUND',
          details: isDevelopment ? error.message : undefined,
        },
        { status: 404 }
      )

    // 外鍵約束違反
    case 'P2003':
      return NextResponse.json(
        {
          error: '資料關聯錯誤',
          code: 'FOREIGN_KEY_CONSTRAINT',
          details: isDevelopment ? error.message : undefined,
        },
        { status: 400 }
      )

    // 欄位不存在
    case 'P2036':
      return NextResponse.json(
        {
          error: '資料庫欄位不存在',
          code: 'COLUMN_NOT_EXISTS',
          details: isDevelopment ? error.message : undefined,
          meta: error.meta,
        },
        { status: 500 }
      )

    // 連接超時
    case 'P1001':
    case 'P1002':
    case 'P1008':
    case 'P1017':
    case 'P2024':
      return NextResponse.json(
        {
          error: '資料庫連接超時，請稍後再試',
          code: 'DB_TIMEOUT',
          details: isDevelopment ? error.message : undefined,
        },
        { status: 503 }
      )

    // 值超出範圍或類型不匹配
    case 'P2022':
      return NextResponse.json(
        {
          error: '資料值不符合欄位類型或超出範圍',
          code: 'VALUE_OUT_OF_RANGE',
          details: isDevelopment ? error.message : undefined,
          meta: isDevelopment ? error.meta : undefined,
        },
        { status: 400 }
      )

    // 其他 Prisma 錯誤
    default:
      console.error(`❌ 未處理的 Prisma 錯誤代碼: ${error.code}`)
      console.error('錯誤 meta:', JSON.stringify(error.meta, null, 2))
      return NextResponse.json(
        {
          error: '資料庫操作失敗',
          code: error.code,
          details: isDevelopment ? error.message : undefined,
          meta: isDevelopment ? error.meta : undefined,
        },
        { status: 500 }
      )
  }
}

/**
 * API 路由包裝器，提供統一的錯誤處理和重試機制
 */
export function withApiHandler<T = any>(
  handler: () => Promise<T>,
  options?: {
    operationName?: string
    successStatus?: number
  }
): Promise<NextResponse> {
  return (async () => {
    try {
      const result = await handler()
      return NextResponse.json(result, { status: options?.successStatus || 200 })
    } catch (error) {
      return createErrorResponse(error, options?.operationName)
    }
  })()
}

/**
 * 包裝資料庫查詢的便捷函數
 */
export async function withDatabaseQuery<T>(
  queryFn: () => Promise<T>,
  operationName?: string
): Promise<T> {
  return db.query(async () => queryFn(), operationName)
}

/**
 * 驗證必要參數
 */
export function validateRequiredParams(
  params: Record<string, any>,
  required: string[]
): { isValid: boolean; missing?: string[] } {
  const missing = required.filter(key => !params[key])
  
  return {
    isValid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  }
}

/**
 * 創建成功響應
 */
export function createSuccessResponse<T = any>(
  data: T,
  options?: {
    message?: string
    statusCode?: number
  }
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...(options?.message && { message: options.message }),
      data,
    },
    { status: options?.statusCode || 200 }
  )
}

/**
 * 分頁參數解析
 */
export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * 創建分頁響應
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  })
}

