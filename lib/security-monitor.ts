import { prisma } from './prisma';
import { SecurityLogger } from './security';

// 安全監控配置
export interface SecurityConfig {
  maxFailedLogins: number;
  lockoutDuration: number; // 分鐘
  passwordExpiryDays: number;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
}

export const defaultSecurityConfig: SecurityConfig = {
  maxFailedLogins: 5,
  lockoutDuration: 30,
  passwordExpiryDays: 90,
  sessionTimeoutMinutes: 60,
  maxConcurrentSessions: 3
};

// 自動化安全監控類
export class SecurityMonitor {
  // 檢查弱密碼
  static async checkWeakPasswords(): Promise<{
    weakPasswordUsers: Array<{ id: string; email: string; reason: string }>;
    recommendations: string[];
  }> {
    const weakPasswordUsers: Array<{ id: string; email: string; reason: string }> = [];
    const recommendations: string[] = [];

    // 檢查常見弱密碼模式
    const users = await prisma.user.findMany({
      select: { id: true, email: true, password: true }
    });

    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'peiplay2025', 'peiplay', 'admin123'
    ];

    for (const user of users) {
      // 注意：這裡只是示例，實際環境中不應該能直接讀取密碼
      // 在實際應用中，應該使用密碼強度檢查 API 或服務
      if (user.email.includes('test') || user.email.includes('demo')) {
        weakPasswordUsers.push({
          id: user.id,
          email: user.email,
          reason: '測試帳號密碼可能較弱'
        });
      }
    }

    if (weakPasswordUsers.length > 0) {
      recommendations.push('發現弱密碼用戶，建議強制重置密碼');
    }

    return { weakPasswordUsers, recommendations };
  }

  // 檢查過期密碼
  static async checkExpiredPasswords(): Promise<{
    expiredUsers: Array<{ id: string; email: string; daysSinceUpdate: number }>;
    recommendations: string[];
  }> {
    const expiredUsers: Array<{ id: string; email: string; daysSinceUpdate: number }> = [];
    const recommendations: string[] = [];

    const users = await prisma.user.findMany({
      select: { id: true, email: true, updatedAt: true }
    });

    const expiryDays = defaultSecurityConfig.passwordExpiryDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - expiryDays);

    for (const user of users) {
      if (user.updatedAt < cutoffDate) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - user.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        expiredUsers.push({
          id: user.id,
          email: user.email,
          daysSinceUpdate
        });
      }
    }

    if (expiredUsers.length > 0) {
      recommendations.push(`${expiredUsers.length} 個用戶密碼已過期，建議強制更新`);
    }

    return { expiredUsers, recommendations };
  }

  // 檢查未驗證用戶
  static async checkUnverifiedUsers(): Promise<{
    unverifiedUsers: Array<{ id: string; email: string; daysSinceCreation: number }>;
    recommendations: string[];
  }> {
    const unverifiedUsers: Array<{ id: string; email: string; daysSinceCreation: number }> = [];
    const recommendations: string[] = [];

    const users = await prisma.user.findMany({
      where: { emailVerified: false },
      select: { id: true, email: true, createdAt: true }
    });

    for (const user of users) {
      const daysSinceCreation = Math.floor(
        (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceCreation > 7) { // 7天未驗證
        unverifiedUsers.push({
          id: user.id,
          email: user.email,
          daysSinceCreation
        });
      }
    }

    if (unverifiedUsers.length > 0) {
      recommendations.push(`${unverifiedUsers.length} 個用戶長期未驗證，建議清理或重新發送驗證`);
    }

    return { unverifiedUsers, recommendations };
  }

  // 檢查異常登入活動
  static async checkSuspiciousActivity(): Promise<{
    suspiciousActivities: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      timestamp: Date;
    }>;
    recommendations: string[];
  }> {
    const suspiciousActivities: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      timestamp: Date;
    }> = [];
    const recommendations: string[] = [];

    // 檢查最近24小時的登入活動
    const recentLogins = await prisma.user.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      select: { id: true, email: true, updatedAt: true }
    });

    // 檢查是否有異常頻繁的登入
    if (recentLogins.length > 50) {
      suspiciousActivities.push({
        type: 'HIGH_LOGIN_VOLUME',
        description: `最近24小時內有 ${recentLogins.length} 次登入活動`,
        severity: 'medium',
        timestamp: new Date()
      });
      recommendations.push('登入活動異常頻繁，建議檢查是否有異常存取');
    }

    // 檢查管理員帳號活動
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, updatedAt: true }
    });

    for (const admin of adminUsers) {
      const hoursSinceLastUpdate = (Date.now() - admin.updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUpdate < 1) {
        suspiciousActivities.push({
          type: 'ADMIN_RECENT_ACTIVITY',
          description: `管理員 ${admin.email} 最近有活動`,
          severity: 'low',
          timestamp: admin.updatedAt
        });
      }
    }

    return { suspiciousActivities, recommendations };
  }

  // 檢查系統健康狀態
  static async checkSystemHealth(): Promise<{
    healthStatus: {
      database: 'healthy' | 'warning' | 'critical';
      email: 'healthy' | 'warning' | 'critical';
      storage: 'healthy' | 'warning' | 'critical';
    };
    recommendations: string[];
  }> {
    const healthStatus = {
      database: 'healthy' as const,
      email: 'healthy' as const,
      storage: 'healthy' as const
    };
    const recommendations: string[] = [];

    try {
      // 檢查資料庫連線
      await prisma.user.count();
    } catch (error) {
      healthStatus.database = 'critical';
      recommendations.push('資料庫連線異常，需要立即檢查');
    }

    // 檢查 Email 服務
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      healthStatus.email = 'critical';
      recommendations.push('Email 服務未配置，通知功能無法使用');
    }

    // 檢查儲存空間（這裡只是示例，實際需要根據部署環境調整）
    try {
      const userCount = await prisma.user.count();
      if (userCount > 10000) {
        healthStatus.storage = 'warning';
        recommendations.push('用戶數量較多，建議監控儲存空間使用情況');
      }
    } catch (error) {
      healthStatus.storage = 'critical';
      recommendations.push('無法檢查儲存狀態');
    }

    return { healthStatus, recommendations };
  }

  // 執行完整安全檢查
  static async performFullSecurityCheck(): Promise<{
    timestamp: string;
    weakPasswords: any;
    expiredPasswords: any;
    unverifiedUsers: any;
    suspiciousActivity: any;
    systemHealth: any;
    overallRecommendations: string[];
    securityScore: number;
  }> {
    const timestamp = new Date().toISOString();
    
    const [weakPasswords, expiredPasswords, unverifiedUsers, suspiciousActivity, systemHealth] = 
      await Promise.all([
        this.checkWeakPasswords(),
        this.checkExpiredPasswords(),
        this.checkUnverifiedUsers(),
        this.checkSuspiciousActivity(),
        this.checkSystemHealth()
      ]);

    // 計算安全分數 (0-100)
    let securityScore = 100;
    
    if (weakPasswords.weakPasswordUsers.length > 0) securityScore -= 20;
    if (expiredPasswords.expiredUsers.length > 0) securityScore -= 15;
    if (unverifiedUsers.unverifiedUsers.length > 0) securityScore -= 10;
    if (suspiciousActivity.suspiciousActivities.length > 0) securityScore -= 15;
    if (systemHealth.healthStatus.database === 'critical') securityScore -= 30;
    if (systemHealth.healthStatus.email === 'critical') securityScore -= 10;
    if (systemHealth.healthStatus.storage === 'critical') securityScore -= 20;

    // 合併所有建議
    const overallRecommendations = [
      ...weakPasswords.recommendations,
      ...expiredPasswords.recommendations,
      ...unverifiedUsers.recommendations,
      ...suspiciousActivity.recommendations,
      ...systemHealth.recommendations
    ];

    // 記錄安全檢查
    SecurityLogger.logSecurityEvent('SECURITY_CHECK_COMPLETED', {
      additionalInfo: {
        securityScore,
        issuesFound: overallRecommendations.length,
        timestamp
      }
    });

    return {
      timestamp,
      weakPasswords,
      expiredPasswords,
      unverifiedUsers,
      suspiciousActivity,
      systemHealth,
      overallRecommendations,
      securityScore: Math.max(0, securityScore)
    };
  }
}
