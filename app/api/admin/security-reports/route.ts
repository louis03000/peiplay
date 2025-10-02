import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SecurityMonitor } from '@/lib/security-monitor';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 生成安全報告
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
    const { reportType, timeRange = '7d' } = body;

    let report;

    switch (reportType) {
      case 'daily':
        report = await generateDailyReport();
        break;
      
      case 'weekly':
        report = await generateWeeklyReport();
        break;
      
      case 'monthly':
        report = await generateMonthlyReport();
        break;
      
      case 'security_summary':
        report = await generateSecuritySummary();
        break;
      
      default:
        return NextResponse.json({ error: '未知的報告類型' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      reportType,
      report,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('生成安全報告失敗:', error);
    return NextResponse.json(
      { error: '生成安全報告失敗' },
      { status: 500 }
    );
  }
}

// 生成每日報告
async function generateDailyReport() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // 獲取昨日數據
  const newUsers = await prisma.user.count({
    where: {
      createdAt: {
        gte: yesterday,
        lt: today
      }
    }
  });

  const newBookings = await prisma.booking.count({
    where: {
      createdAt: {
        gte: yesterday,
        lt: today
      }
    }
  });

  const verifiedUsers = await prisma.user.count({
    where: {
      emailVerified: true,
      updatedAt: {
        gte: yesterday,
        lt: today
      }
    }
  });

  // 執行安全檢查
  const securityCheck = await SecurityMonitor.performFullSecurityCheck();

  return {
    date: yesterday.toISOString().split('T')[0],
    summary: {
      newUsers,
      newBookings,
      verifiedUsers,
      securityScore: securityCheck.securityScore
    },
    securityIssues: securityCheck.overallRecommendations,
    recommendations: generateRecommendations(securityCheck)
  };
}

// 生成每週報告
async function generateWeeklyReport() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // 獲取週數據
  const newUsers = await prisma.user.count({
    where: {
      createdAt: {
        gte: weekAgo
      }
    }
  });

  const newBookings = await prisma.booking.count({
    where: {
      createdAt: {
        gte: weekAgo
      }
    }
  });

  const verifiedUsers = await prisma.user.count({
    where: {
      emailVerified: true,
      updatedAt: {
        gte: weekAgo
      }
    }
  });

  // 用戶增長趨勢
  const dailyUserGrowth = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dailyUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    dailyUserGrowth.push({
      date: date.toISOString().split('T')[0],
      users: dailyUsers
    });
  }

  // 執行安全檢查
  const securityCheck = await SecurityMonitor.performFullSecurityCheck();

  return {
    period: `${weekAgo.toISOString().split('T')[0]} 至 ${now.toISOString().split('T')[0]}`,
    summary: {
      newUsers,
      newBookings,
      verifiedUsers,
      securityScore: securityCheck.securityScore
    },
    trends: {
      dailyUserGrowth
    },
    securityIssues: securityCheck.overallRecommendations,
    recommendations: generateRecommendations(securityCheck)
  };
}

// 生成每月報告
async function generateMonthlyReport() {
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // 獲取月數據
  const newUsers = await prisma.user.count({
    where: {
      createdAt: {
        gte: monthAgo
      }
    }
  });

  const newBookings = await prisma.booking.count({
    where: {
      createdAt: {
        gte: monthAgo
      }
    }
  });

  const totalUsers = await prisma.user.count();
  const totalBookings = await prisma.booking.count();

  // 用戶角色分布
  const userRoles = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true }
  });

  // 預約狀態分布
  const bookingStatuses = await prisma.booking.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  // 執行安全檢查
  const securityCheck = await SecurityMonitor.performFullSecurityCheck();

  return {
    period: `${monthAgo.toISOString().split('T')[0]} 至 ${now.toISOString().split('T')[0]}`,
    summary: {
      newUsers,
      newBookings,
      totalUsers,
      totalBookings,
      securityScore: securityCheck.securityScore
    },
    distributions: {
      userRoles: userRoles.map(role => ({
        role: role.role,
        count: role._count.role
      })),
      bookingStatuses: bookingStatuses.map(status => ({
        status: status.status,
        count: status._count.status
      }))
    },
    securityIssues: securityCheck.overallRecommendations,
    recommendations: generateRecommendations(securityCheck)
  };
}

// 生成安全摘要
async function generateSecuritySummary() {
  const securityCheck = await SecurityMonitor.performFullSecurityCheck();
  
  // 獲取系統統計
  const totalUsers = await prisma.user.count();
  const verifiedUsers = await prisma.user.count({
    where: { emailVerified: true }
  });
  const adminUsers = await prisma.user.count({
    where: { role: 'ADMIN' }
  });

  // 計算安全指標
  const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0;
  const adminRatio = totalUsers > 0 ? (adminUsers / totalUsers * 100).toFixed(2) : 0;

  return {
    generatedAt: new Date().toISOString(),
    securityScore: securityCheck.securityScore,
    securityLevel: getSecurityLevel(securityCheck.securityScore),
    metrics: {
      totalUsers,
      verifiedUsers,
      adminUsers,
      verificationRate: parseFloat(verificationRate),
      adminRatio: parseFloat(adminRatio)
    },
    issues: {
      weakPasswords: securityCheck.weakPasswords.weakPasswordUsers.length,
      expiredPasswords: securityCheck.expiredPasswords.expiredUsers.length,
      unverifiedUsers: securityCheck.unverifiedUsers.unverifiedUsers.length,
      suspiciousActivities: securityCheck.suspiciousActivity.suspiciousActivities.length
    },
    systemHealth: securityCheck.systemHealth.healthStatus,
    recommendations: securityCheck.overallRecommendations,
    priorityActions: getPriorityActions(securityCheck)
  };
}

// 生成建議
function generateRecommendations(securityCheck: any): string[] {
  const recommendations: string[] = [];

  if (securityCheck.securityScore < 70) {
    recommendations.push('安全分數較低，建議立即處理安全問題');
  }

  if (securityCheck.weakPasswords.weakPasswordUsers.length > 0) {
    recommendations.push('發現弱密碼用戶，建議強制重置密碼');
  }

  if (securityCheck.expiredPasswords.expiredUsers.length > 0) {
    recommendations.push('有密碼過期用戶，建議通知更新密碼');
  }

  if (securityCheck.unverifiedUsers.unverifiedUsers.length > 0) {
    recommendations.push('有長期未驗證用戶，建議清理或重新發送驗證');
  }

  if (securityCheck.systemHealth.healthStatus.database === 'critical') {
    recommendations.push('資料庫狀態異常，需要立即檢查');
  }

  if (securityCheck.systemHealth.healthStatus.email === 'critical') {
    recommendations.push('Email 服務異常，通知功能無法使用');
  }

  return recommendations;
}

// 獲取安全等級
function getSecurityLevel(score: number): string {
  if (score >= 90) return '優秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '一般';
  if (score >= 60) return '較差';
  return '危險';
}

// 獲取優先操作
function getPriorityActions(securityCheck: any): string[] {
  const actions: string[] = [];

  if (securityCheck.systemHealth.healthStatus.database === 'critical') {
    actions.push('立即檢查資料庫連線');
  }

  if (securityCheck.weakPasswords.weakPasswordUsers.length > 0) {
    actions.push('強制重置弱密碼用戶');
  }

  if (securityCheck.expiredPasswords.expiredUsers.length > 0) {
    actions.push('通知密碼過期用戶');
  }

  if (securityCheck.suspiciousActivity.suspiciousActivities.length > 0) {
    actions.push('調查可疑活動');
  }

  return actions;
}

// 獲取可用的報告類型
export async function GET() {
  return NextResponse.json({
    availableReports: [
      {
        id: 'daily',
        name: '每日安全報告',
        description: '包含每日用戶活動和安全狀態摘要',
        estimatedTime: '5-10秒'
      },
      {
        id: 'weekly',
        name: '每週安全報告',
        description: '包含週度趨勢分析和安全評估',
        estimatedTime: '10-15秒'
      },
      {
        id: 'monthly',
        name: '每月安全報告',
        description: '包含月度統計數據和詳細分析',
        estimatedTime: '15-30秒'
      },
      {
        id: 'security_summary',
        name: '安全摘要報告',
        description: '系統整體安全狀態和優先操作建議',
        estimatedTime: '10-20秒'
      }
    ]
  });
}
