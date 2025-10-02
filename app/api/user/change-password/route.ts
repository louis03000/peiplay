import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { compare, hash } from 'bcryptjs';
import { SecurityLogger } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '請提供目前密碼和新密碼' }, { status: 400 });
    }

    // 基本密碼驗證
    if (newPassword.length < 8) {
      return NextResponse.json({ error: '新密碼長度至少 8 個字符' }, { status: 400 });
    }

    if (newPassword.length > 128) {
      return NextResponse.json({ error: '密碼長度不能超過 128 個字符' }, { status: 400 });
    }

    // 檢查是否包含至少一個英文字母
    if (!/[a-zA-Z]/.test(newPassword)) {
      return NextResponse.json({ error: '密碼必須包含至少一個英文字母' }, { status: 400 });
    }

    // 檢查是否包含至少一個數字
    if (!/\d/.test(newPassword)) {
      return NextResponse.json({ error: '密碼必須包含至少一個數字' }, { status: 400 });
    }

    // 檢查常見弱密碼
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'peiplay2025', 'peiplay', 'admin123', '12345678',
      'abcdefgh', 'abcdefg1', '1234567a', 'asdfghjk'
    ];

    if (commonPasswords.includes(newPassword.toLowerCase())) {
      return NextResponse.json({ error: '密碼過於常見，請選擇更安全的密碼' }, { status: 400 });
    }

    // 檢查是否為純數字或純字母
    if (/^\d+$/.test(newPassword)) {
      return NextResponse.json({ error: '密碼不能只包含數字' }, { status: 400 });
    }

    if (/^[a-zA-Z]+$/.test(newPassword)) {
      return NextResponse.json({ error: '密碼不能只包含英文字母' }, { status: 400 });
    }

    // 獲取用戶資料
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, password: true }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 驗證目前密碼
    const isCurrentPasswordValid = await compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      // 記錄失敗的密碼更新嘗試
      SecurityLogger.logSecurityEvent('PASSWORD_CHANGE_FAILED', {
        userId: user.id,
        email: user.email,
        additionalInfo: { reason: 'invalid_current_password' }
      });
      
      return NextResponse.json({ error: '目前密碼不正確' }, { status: 400 });
    }

    // 檢查新密碼是否與目前密碼相同
    const isSamePassword = await compare(newPassword, user.password);
    if (isSamePassword) {
      return NextResponse.json({ error: '新密碼不能與目前密碼相同' }, { status: 400 });
    }

    // 加密新密碼
    const hashedNewPassword = await hash(newPassword, 12);

    // 更新密碼
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    });

    // 記錄成功的密碼更新
    SecurityLogger.logSecurityEvent('PASSWORD_CHANGED', {
      userId: user.id,
      email: user.email,
      additionalInfo: { 
        timestamp: new Date().toISOString(),
        passwordStrength: getPasswordStrength(newPassword)
      }
    });

    return NextResponse.json({
      success: true,
      message: '密碼更新成功'
    });

  } catch (error) {
    console.error('密碼更新失敗:', error);
    
    SecurityLogger.logSecurityEvent('PASSWORD_CHANGE_ERROR', {
      additionalInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json(
      { error: '密碼更新失敗' },
      { status: 500 }
    );
  }
}

// 計算密碼強度
function getPasswordStrength(password: string): string {
  let strength = 0;
  
  // 長度檢查
  if (password.length >= 8) strength += 2; // 8字符以上給2分
  if (password.length >= 12) strength += 1; // 12字符以上額外加1分
  
  // 字符類型檢查
  if (/[a-zA-Z]/.test(password)) strength += 1; // 有英文字母
  if (/\d/.test(password)) strength += 1; // 有數字
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 1; // 有特殊字符
  
  // 大小寫混合
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;

  if (strength <= 3) return 'weak';
  if (strength <= 5) return 'medium';
  return 'strong';
}
