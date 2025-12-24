/**
 * API 防護機制
 * 
 * 設計原則：
 * 1. 所有 API route 必須使用此防護
 * 2. try/catch 包整個 handler
 * 3. 明確 return status code
 * 4. 不可 throw 未處理 error
 * 5. 不可讓 Promise 未 await 結束
 */

import { NextResponse } from 'next/server'

// ========== 錯誤處理 ==========
export interface ApiError {
  message: string
  code?: string
  statusCode: number
  details?: any
}

/**
 * 創建標準化的錯誤響應
 */
export function createErrorResponse(
  error: unknown,
  context: string,
  defaultStatusCode: number = 500
): NextResponse {
  console.error(`❌ [${context}] API Error:`, error)

  let statusCode = defaultStatusCode
  let message = '伺服器錯誤'
  let code: string | undefined
  let details: any = undefined

  if (error instanceof Error) {
    message = error.message || message
    
    // 處理 Prisma 錯誤
    const errorCode = (error as any).code
    if (errorCode) {
      code = errorCode
      
      // 根據錯誤代碼設置狀態碼
      if (typeof code === 'string') {
        if (code.startsWith('P2')) {
          statusCode = 400 // 客戶端錯誤
        } else if (code.startsWith('P1')) {
          statusCode = 503 // 服務不可用
        }
      }
    }
  }

  return NextResponse.json(
    {
      error: message,
      code,
      ...(details && { details }),
    },
    { status: statusCode }
  )
}

/**
 * API Handler 包裝器
 * 
 * 確保所有錯誤都被正確處理
 */
export function withApiGuard<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const response = await handler(...args)
      
      // 確保返回的是 NextResponse
      if (!(response instanceof NextResponse)) {
        console.error('❌ Handler 未返回 NextResponse')
        return NextResponse.json(
          { error: '伺服器錯誤：無效的響應' },
          { status: 500 }
        )
      }
      
      return response
    } catch (error) {
      // 如果已經返回了 NextResponse，直接返回
      if (error instanceof NextResponse) {
        return error
      }
      
      // 處理其他錯誤
      return createErrorResponse(error, 'API Guard')
    }
  }
}

/**
 * 驗證請求方法
 */
export function validateMethod(
  request: Request,
  allowedMethods: string[]
): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    return NextResponse.json(
      { error: `不允許的請求方法: ${request.method}` },
      { status: 405 }
    )
  }
  return null
}

/**
 * 驗證請求體（JSON）
 */
export async function validateJsonBody<T>(
  request: Request,
  validator?: (body: any) => body is T
): Promise<{ valid: false; error: NextResponse } | { valid: true; data: T }> {
  try {
    const body = await request.json()
    
    if (validator && !validator(body)) {
      return {
        valid: false,
        error: NextResponse.json(
          { error: '請求體格式錯誤' },
          { status: 400 }
        ),
      }
    }
    
    return { valid: true, data: body }
  } catch (error) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: '無法解析請求體（必須是有效的 JSON）' },
        { status: 400 }
      ),
    }
  }
}

/**
 * 確保 Promise 被正確 await
 * 
 * 用於包裝異步操作，確保不會有未處理的 Promise
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    console.error('❌ safeAsync 錯誤:', error)
    if (onError) {
      onError(error)
    }
    return null
  }
}

