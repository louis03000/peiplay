import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import type { PrismaClient } from '@prisma/client'
import { SecurityLogger } from '@/lib/security'
import { sendEmailVerificationCode } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 403 })
    }

    const body = await request.json()
    const { actionType, targetUserId, reason } = body as {
      actionType?: string
      targetUserId?: string
      reason?: string
    }

    if (!actionType || !targetUserId) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const actionResult = await db.query(async (client) => {
      const targetUser = await client.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          partner: {
            select: { id: true },
          },
          customer: {
            select: { id: true },
          },
        },
      })

      if (!targetUser) {
        return { type: 'NOT_FOUND' } as const
      }

      let result: any

      switch (actionType) {
        case 'force_password_reset':
          result = forcePasswordReset(reason)
          break
        case 'suspend_user':
          result = await suspendUser(client, targetUserId, reason)
          break
        case 'unsuspend_user':
          result = await unsuspendUser(client, targetUserId, reason)
          break
        case 'delete_user':
          if (targetUser.role === 'ADMIN') {
            return { type: 'FORBIDDEN_DELETE_ADMIN' } as const
          }
          result = await deleteUser(client, targetUser, reason)
          break
        case 'resend_verification':
          result = await resendVerification(client, targetUserId)
          break
        case 'verify_user_manually':
          result = await verifyUserManually(client, targetUserId, reason)
          break
        default:
          return { type: 'UNKNOWN_ACTION' } as const
      }

      return {
        type: 'SUCCESS',
        result,
        targetUser,
      } as const
    }, 'admin:security-actions:execute')

    switch (actionResult.type) {
      case 'NOT_FOUND':
        return NextResponse.json({ error: '用戶不存在' }, { status: 404 })
      case 'FORBIDDEN_DELETE_ADMIN':
        return NextResponse.json({ error: '不能刪除管理員帳號' }, { status: 400 })
      case 'UNKNOWN_ACTION':
        return NextResponse.json({ error: '未知的操作類型' }, { status: 400 })
      case 'SUCCESS':
        SecurityLogger.logSecurityEvent('SECURITY_ACTION_EXECUTED', {
          userId: session.user.id,
          additionalInfo: {
            actionType,
            targetUserId,
            targetUserEmail: actionResult.targetUser.email,
            reason,
            timestamp: new Date().toISOString(),
          },
        })

        return NextResponse.json({
          success: true,
          actionType,
          targetUser: {
            id: actionResult.targetUser.id,
            email: actionResult.targetUser.email,
            name: actionResult.targetUser.name,
          },
          result: actionResult.result,
          timestamp: new Date().toISOString(),
        })
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    SecurityLogger.logSecurityEvent('SECURITY_ACTION_ERROR', {
      additionalInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    })

    return createErrorResponse(error, 'admin:security-actions:execute')
  }
}

function forcePasswordReset(reason?: string) {
  return {
    message: '已記錄密碼提醒，用戶可選擇是否更新密碼',
    note: '這是一個友善提醒，不會強制用戶重設密碼',
    reason,
  }
}

async function suspendUser(client: PrismaClient, userId: string, reason?: string) {
  const suspensionEndsAt = new Date()
  suspensionEndsAt.setDate(suspensionEndsAt.getDate() + 30)

  await client.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspensionEndsAt,
      suspensionReason: reason ?? '系統管理員操作',
    },
  })

  return {
    message: '用戶已被暫停',
    suspensionEndsAt,
    reason,
  }
}

async function unsuspendUser(client: PrismaClient, userId: string, reason?: string) {
  await client.user.update({
    where: { id: userId },
    data: {
      isSuspended: false,
      suspensionEndsAt: null,
      suspensionReason: null,
    },
  })

  return {
    message: '用戶暫停已解除',
    reason,
  }
}

async function deleteUser(client: PrismaClient, user: {
  id: string
  partner: { id: string } | null
  customer: { id: string } | null
  email: string | null
  name: string | null
  role: string
}, reason?: string) {
  await client.$transaction(async (tx) => {
    if (user.partner) {
      // 檢查是否有提領記錄（提領記錄永久保存，不允許刪除）
      const withdrawalCount = await tx.withdrawalRequest.count({
        where: { partnerId: user.partner.id },
      });
      
      if (withdrawalCount > 0) {
        // 如果有提領記錄，不允許刪除 Partner（提領記錄需要永久保存）
        throw new Error(`無法刪除用戶：該夥伴有 ${withdrawalCount} 筆提領記錄，提領記錄需要永久保存`);
      }
      
      await tx.schedule.deleteMany({ where: { partnerId: user.partner.id } })
      await tx.partner.delete({ where: { id: user.partner.id } })
    }

    if (user.customer) {
      // 先刪除群組預約參與者記錄（避免外鍵約束衝突）
      await tx.groupBookingParticipant.deleteMany({ 
        where: { customerId: user.customer.id } 
      });
      
      await tx.booking.deleteMany({ where: { customerId: user.customer.id } })
      await tx.order.deleteMany({ where: { customerId: user.customer.id } })
      await tx.customer.delete({ where: { id: user.customer.id } })
    }

    await tx.review.deleteMany({
      where: {
        OR: [
          { reviewerId: user.id },
          { revieweeId: user.id },
        ],
      },
    })

    await tx.user.delete({ where: { id: user.id } })
  })

  return {
    message: '用戶及其相關資料已刪除',
    reason,
  }
}

async function resendVerification(client: PrismaClient, userId: string) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerified: true },
  })

  if (!user) {
    throw new Error('用戶不存在')
  }

  if (user.emailVerified) {
    throw new Error('用戶已驗證，無需重新發送')
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await client.user.update({
    where: { id: userId },
    data: {
      emailVerificationCode: verificationCode,
      emailVerificationExpires: expiresAt,
    },
  })

  const emailSent = await sendEmailVerificationCode(
    user.email,
    user.name || '用戶',
    verificationCode
  )

  return {
    message: '驗證碼已重新發送',
    emailSent,
    expiresAt,
  }
}

async function verifyUserManually(client: PrismaClient, userId: string, reason?: string) {
  await client.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpires: null,
    },
  })

  return {
    message: '用戶已手動驗證',
    reason,
  }
}

export async function GET() {
  return NextResponse.json({
    availableActions: [
      {
        id: 'force_password_reset',
        name: '友善密碼提醒',
        description: '友善提醒用戶更新密碼（不強制）',
        requiresReason: true,
        severity: 'low',
      },
      {
        id: 'suspend_user',
        name: '暫停用戶',
        description: '暫停用戶帳號30天',
        requiresReason: true,
        severity: 'high',
      },
      {
        id: 'unsuspend_user',
        name: '解除暫停',
        description: '解除用戶暫停狀態',
        requiresReason: true,
        severity: 'low',
      },
      {
        id: 'delete_user',
        name: '刪除用戶',
        description: '永久刪除用戶及其所有資料',
        requiresReason: true,
        severity: 'critical',
      },
      {
        id: 'resend_verification',
        name: '重新發送驗證碼',
        description: '重新發送 Email 驗證碼',
        requiresReason: false,
        severity: 'low',
      },
      {
        id: 'verify_user_manually',
        name: '手動驗證用戶',
        description: '手動驗證用戶 Email',
        requiresReason: true,
        severity: 'low',
      },
    ],
  })
}
