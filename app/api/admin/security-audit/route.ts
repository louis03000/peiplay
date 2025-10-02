import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InputValidator } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    // 執行安全審計
    const auditResults = await performSecurityAudit();

    return NextResponse.json({
      success: true,
      auditResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('安全審計失敗:', error);
    return NextResponse.json(
      { error: '安全審計失敗' },
      { status: 500 }
    );
  }
}

async function performSecurityAudit() {
  const results = {
    userSecurity: await auditUserSecurity(),
    passwordSecurity: await auditPasswordSecurity(),
    emailSecurity: await auditEmailSecurity(),
    systemSecurity: await auditSystemSecurity(),
    recommendations: [] as string[]  // 明確指定類型為 string[]
  };

  // 生成建議
  results.recommendations = generateSecurityRecommendations(results);

  return results;
}

async function auditUserSecurity() {
  const totalUsers = await prisma.user.count();
  const verifiedUsers = await prisma.user.count({
    where: { emailVerified: true }
  });
  const unverifiedUsers = totalUsers - verifiedUsers;
  
  const adminUsers = await prisma.user.count({
    where: { role: 'ADMIN' }
  });

  return {
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    adminUsers,
    verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0
  };
}

async function auditPasswordSecurity() {
  // 檢查弱密碼（這裡只是示例，實際應該檢查密碼強度）
  const usersWithWeakPasswords = await prisma.user.findMany({
    where: {
      OR: [
        { password: { contains: 'password' } },
        { password: { contains: '123456' } },
        { password: { contains: 'admin' } }
      ]
    },
    select: { id: true, email: true }
  });

  return {
    weakPasswordCount: usersWithWeakPasswords.length,
    weakPasswordUsers: usersWithWeakPasswords.map(u => u.email)
  };
}

async function auditEmailSecurity() {
  const duplicateEmails = await prisma.user.groupBy({
    by: ['email'],
    _count: { email: true },
    having: {
      email: {
        _count: {
          gt: 1
        }
      }
    }
  });

  return {
    duplicateEmailCount: duplicateEmails.length,
    duplicateEmails: duplicateEmails.map(d => d.email)
  };
}

async function auditSystemSecurity() {
  // 檢查最近的登入活動
  const recentLogins = await prisma.user.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近 24 小時
      }
    },
    select: { id: true, email: true, updatedAt: true }
  });

  // 檢查未驗證的用戶
  const oldUnverifiedUsers = await prisma.user.findMany({
    where: {
      emailVerified: false,
      createdAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 天前創建
      }
    },
    select: { id: true, email: true, createdAt: true }
  });

  return {
    recentLoginCount: recentLogins.length,
    oldUnverifiedUsersCount: oldUnverifiedUsers.length,
    oldUnverifiedUsers: oldUnverifiedUsers.map(u => ({
      email: u.email,
      createdAt: u.createdAt
    }))
  };
}

function generateSecurityRecommendations(auditResults: any): string[] {
  const recommendations: string[] = [];

  // 基於審計結果生成建議
  if (auditResults.userSecurity.verificationRate < 80) {
    recommendations.push('Email 驗證率較低，建議加強驗證流程');
  }

  if (auditResults.passwordSecurity.weakPasswordCount > 0) {
    recommendations.push('發現弱密碼用戶，建議強制重置密碼');
  }

  if (auditResults.emailSecurity.duplicateEmailCount > 0) {
    recommendations.push('發現重複 Email，需要清理數據');
  }

  if (auditResults.systemSecurity.oldUnverifiedUsersCount > 0) {
    recommendations.push('有長期未驗證的用戶，建議清理或重新發送驗證');
  }

  if (auditResults.userSecurity.adminUsers > 3) {
    recommendations.push('管理員帳號過多，建議審查權限');
  }

  return recommendations;
}
