import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const auditResults = await db.query(async (client) => {
      return performSecurityAudit(client)
    }, 'admin:security-audit')

    return NextResponse.json({
      success: true,
      auditResults,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return createErrorResponse(error, 'admin:security-audit')
  }
}

async function performSecurityAudit(client: Parameters<typeof db.query>[0]) {
  const userSecurity = await auditUserSecurity(client)
  const passwordSecurity = await auditPasswordSecurity(client)
  const emailSecurity = await auditEmailSecurity(client)
  const systemSecurity = await auditSystemSecurity(client)

  const auditResults = {
    userSecurity,
    passwordSecurity,
    emailSecurity,
    systemSecurity,
    recommendations: [] as string[],
  }

  auditResults.recommendations = generateSecurityRecommendations(auditResults)

  return auditResults
}

async function auditUserSecurity(client: Parameters<typeof db.query>[0]) {
  const totalUsers = await client.user.count()
  const verifiedUsers = await client.user.count({
    where: { emailVerified: true },
  })
  const unverifiedUsers = totalUsers - verifiedUsers

  const adminUsers = await client.user.count({
    where: { role: 'ADMIN' },
  })

  return {
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    adminUsers,
    verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : '0',
  }
}

async function auditPasswordSecurity(client: Parameters<typeof db.query>[0]) {
  const usersWithWeakPasswords = await client.user.findMany({
    where: {
      OR: [
        { password: { contains: 'password' } },
        { password: { contains: '123456' } },
        { password: { contains: 'admin' } },
      ],
    },
    select: { id: true, email: true },
  })

  return {
    weakPasswordCount: usersWithWeakPasswords.length,
    weakPasswordUsers: usersWithWeakPasswords.map((u) => u.email),
  }
}

async function auditEmailSecurity(client: Parameters<typeof db.query>[0]) {
  const duplicateEmails = await client.user.groupBy({
    by: ['email'],
    _count: { email: true },
    having: {
      email: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  return {
    duplicateEmailCount: duplicateEmails.length,
    duplicateEmails: duplicateEmails.map((d) => d.email),
  }
}

async function auditSystemSecurity(client: Parameters<typeof db.query>[0]) {
  const recentLogins = await client.user.findMany({
    where: {
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, email: true, updatedAt: true },
  })

  const oldUnverifiedUsers = await client.user.findMany({
    where: {
      emailVerified: false,
      createdAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, email: true, createdAt: true },
  })

  return {
    recentLoginCount: recentLogins.length,
    oldUnverifiedUsersCount: oldUnverifiedUsers.length,
    oldUnverifiedUsers: oldUnverifiedUsers.map((u) => ({
      email: u.email,
      createdAt: u.createdAt,
    })),
  }
}

function generateSecurityRecommendations(auditResults: any): string[] {
  const recommendations: string[] = []

  if (Number(auditResults.userSecurity.verificationRate) < 80) {
    recommendations.push('Email 驗證率較低，建議加強驗證流程')
  }

  if (auditResults.passwordSecurity.weakPasswordCount > 0) {
    recommendations.push('發現弱密碼用戶，建議強制重置密碼')
  }

  if (auditResults.emailSecurity.duplicateEmailCount > 0) {
    recommendations.push('發現重複 Email，需要清理數據')
  }

  if (auditResults.systemSecurity.oldUnverifiedUsersCount > 0) {
    recommendations.push('有長期未驗證的用戶，建議清理或重新發送驗證')
  }

  if (auditResults.userSecurity.adminUsers > 3) {
    recommendations.push('管理員帳號過多，建議審查權限')
  }

  return recommendations
}
