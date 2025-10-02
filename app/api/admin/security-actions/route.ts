import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SecurityLogger } from '@/lib/security';
import { sendEmailVerificationCode } from '@/lib/email';

export const dynamic = 'force-dynamic';

// 執行安全操作
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { actionType, targetUserId, reason } = body;

    if (!actionType || !targetUserId) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 獲取目標用戶
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    let result;

    switch (actionType) {
      case 'force_password_reset':
        // 強制密碼重設
        result = await forcePasswordReset(targetUserId, reason);
        break;
      
      case 'suspend_user':
        // 暫停用戶
        result = await suspendUser(targetUserId, reason);
        break;
      
      case 'unsuspend_user':
        // 解除暫停
        result = await unsuspendUser(targetUserId, reason);
        break;
      
      case 'delete_user':
        // 刪除用戶
        result = await deleteUser(targetUserId, reason);
        break;
      
      case 'resend_verification':
        // 重新發送驗證碼
        result = await resendVerification(targetUserId);
        break;
      
      case 'verify_user_manually':
        // 手動驗證用戶
        result = await verifyUserManually(targetUserId, reason);
        break;
      
      default:
        return NextResponse.json({ error: '未知的操作類型' }, { status: 400 });
    }

    // 記錄安全操作
    SecurityLogger.logSecurityEvent('SECURITY_ACTION_EXECUTED', {
      userId: session.user.id,
      additionalInfo: {
        actionType,
        targetUserId,
        targetUserEmail: targetUser.email,
        reason,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      actionType,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name
      },
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('安全操作執行失敗:', error);
    
    SecurityLogger.logSecurityEvent('SECURITY_ACTION_ERROR', {
      additionalInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json(
      { error: '安全操作執行失敗' },
      { status: 500 }
    );
  }
}

// 友善密碼提醒（不強制重設）
async function forcePasswordReset(userId: string, reason: string) {
  // 這裡只是記錄提醒，不強制用戶重設密碼
  // 實際應用中可以發送友善的提醒 Email
  
  return {
    message: '已記錄密碼提醒，用戶可選擇是否更新密碼',
    note: '這是一個友善提醒，不會強制用戶重設密碼',
    reason
  };
}

// 暫停用戶
async function suspendUser(userId: string, reason: string) {
  const suspensionEndsAt = new Date();
  suspensionEndsAt.setDate(suspensionEndsAt.getDate() + 30); // 暫停30天

  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: true,
      suspensionEndsAt,
      suspensionReason: reason
    }
  });

  return {
    message: '用戶已被暫停',
    suspensionEndsAt,
    reason
  };
}

// 解除暫停
async function unsuspendUser(userId: string, reason: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: false,
      suspensionEndsAt: null,
      suspensionReason: null
    }
  });

  return {
    message: '用戶暫停已解除',
    reason
  };
}

// 刪除用戶
async function deleteUser(userId: string, reason: string) {
  // 檢查是否為管理員
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  if (user?.role === 'ADMIN') {
    throw new Error('不能刪除管理員帳號');
  }

  // 刪除相關資料
  await prisma.$transaction(async (tx) => {
    // 刪除用戶的預約記錄
    await tx.booking.deleteMany({
      where: { customerId: userId }
    });

    // 刪除用戶的夥伴資料
    await tx.partner.deleteMany({
      where: { userId: userId }
    });

    // 刪除用戶的客戶資料
    await tx.customer.deleteMany({
      where: { userId: userId }
    });

    // 刪除用戶的評論
    await tx.review.deleteMany({
      where: { 
        OR: [
          { reviewerId: userId },
          { revieweeId: userId }
        ]
      }
    });

    // 最後刪除用戶
    await tx.user.delete({
      where: { id: userId }
    });
  });

  return {
    message: '用戶及其相關資料已刪除',
    reason
  };
}

// 重新發送驗證碼
async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerified: true }
  });

  if (!user) {
    throw new Error('用戶不存在');
  }

  if (user.emailVerified) {
    throw new Error('用戶已驗證，無需重新發送');
  }

  // 生成新的驗證碼
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘後過期

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationCode: verificationCode,
      emailVerificationExpires: expiresAt
    }
  });

  // 發送驗證碼 Email
  const emailSent = await sendEmailVerificationCode(
    user.email,
    user.name || '用戶',
    verificationCode
  );

  return {
    message: '驗證碼已重新發送',
    emailSent,
    expiresAt
  };
}

// 手動驗證用戶
async function verifyUserManually(userId: string, reason: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpires: null
    }
  });

  return {
    message: '用戶已手動驗證',
    reason
  };
}

// 獲取可用的安全操作列表
export async function GET() {
  return NextResponse.json({
    availableActions: [
      {
        id: 'force_password_reset',
        name: '友善密碼提醒',
        description: '友善提醒用戶更新密碼（不強制）',
        requiresReason: true,
        severity: 'low'
      },
      {
        id: 'suspend_user',
        name: '暫停用戶',
        description: '暫停用戶帳號30天',
        requiresReason: true,
        severity: 'high'
      },
      {
        id: 'unsuspend_user',
        name: '解除暫停',
        description: '解除用戶暫停狀態',
        requiresReason: true,
        severity: 'low'
      },
      {
        id: 'delete_user',
        name: '刪除用戶',
        description: '永久刪除用戶及其所有資料',
        requiresReason: true,
        severity: 'critical'
      },
      {
        id: 'resend_verification',
        name: '重新發送驗證碼',
        description: '重新發送 Email 驗證碼',
        requiresReason: false,
        severity: 'low'
      },
      {
        id: 'verify_user_manually',
        name: '手動驗證用戶',
        description: '手動驗證用戶 Email',
        requiresReason: true,
        severity: 'low'
      }
    ]
  });
}
