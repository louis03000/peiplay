import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { verifyTOTPToken, setupMFA } from '@/lib/mfa-service'

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { email: session.user.email }
      }) as { id: string; twoFactorSecret: string | null; isTwoFactorEnabled: boolean } | null

      if (!user) {
        throw new Error('User not found')
      }

      if (!user?.twoFactorSecret) {
        throw new Error('2FA not set up')
      }

      // 驗證 TOTP token
      const verified = verifyTOTPToken(user.twoFactorSecret, token)

      if (!verified) {
        throw new Error('Invalid token')
      }

      // 如果尚未啟用，現在啟用並生成 recovery codes
      if (!user.isTwoFactorEnabled) {
        const { recoveryCodes } = await setupMFA(user.id, user.twoFactorSecret);
        return { 
          success: true, 
          recoveryCodes, // 返回 recovery codes 給用戶保存
          message: '2FA 已啟用，請保存您的 recovery codes'
        }
      }

      return { success: true }
    }, '2fa/verify')

    return NextResponse.json(result)
  } catch (error) {
    console.error('2FA verification error:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const status = errorMessage.includes('not found') || errorMessage.includes('not set up') ? 404 :
                   errorMessage.includes('Invalid token') ? 400 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}
