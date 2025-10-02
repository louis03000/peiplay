import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SecurityMonitor } from '@/lib/security-monitor';
import { SecurityLogger } from '@/lib/security';

export const dynamic = 'force-dynamic';

// 執行自動化安全任務
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
    const { taskType } = body;

    let result;

    switch (taskType) {
      case 'full_check':
        result = await SecurityMonitor.performFullSecurityCheck();
        break;
      
      case 'weak_passwords':
        result = await SecurityMonitor.checkWeakPasswords();
        break;
      
      case 'expired_passwords':
        result = await SecurityMonitor.checkExpiredPasswords();
        break;
      
      case 'unverified_users':
        result = await SecurityMonitor.checkUnverifiedUsers();
        break;
      
      case 'suspicious_activity':
        result = await SecurityMonitor.checkSuspiciousActivity();
        break;
      
      case 'system_health':
        result = await SecurityMonitor.checkSystemHealth();
        break;
      
      default:
        return NextResponse.json({ error: '未知的任務類型' }, { status: 400 });
    }

    // 記錄任務執行
    SecurityLogger.logSecurityEvent('SECURITY_TASK_EXECUTED', {
      userId: session.user.id,
      additionalInfo: {
        taskType,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      taskType,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('安全任務執行失敗:', error);
    
    SecurityLogger.logSecurityEvent('SECURITY_TASK_ERROR', {
      additionalInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json(
      { error: '安全任務執行失敗' },
      { status: 500 }
    );
  }
}

// 獲取可用的安全任務列表
export async function GET() {
  return NextResponse.json({
    availableTasks: [
      {
        id: 'full_check',
        name: '完整安全檢查',
        description: '執行所有安全檢查項目',
        estimatedTime: '30-60秒'
      },
      {
        id: 'weak_passwords',
        name: '弱密碼檢查',
        description: '檢查系統中的弱密碼用戶',
        estimatedTime: '5-10秒'
      },
      {
        id: 'expired_passwords',
        name: '過期密碼檢查',
        description: '檢查密碼已過期的用戶',
        estimatedTime: '5-10秒'
      },
      {
        id: 'unverified_users',
        name: '未驗證用戶檢查',
        description: '檢查長期未驗證的用戶',
        estimatedTime: '5-10秒'
      },
      {
        id: 'suspicious_activity',
        name: '可疑活動檢查',
        description: '檢查異常登入和可疑活動',
        estimatedTime: '10-15秒'
      },
      {
        id: 'system_health',
        name: '系統健康檢查',
        description: '檢查系統各組件健康狀態',
        estimatedTime: '5-10秒'
      }
    ]
  });
}
