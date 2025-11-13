import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import speakeasy from 'speakeasy'
import type { Prisma } from '@prisma/client'


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
      }) as { id: string; twoFactorSecret: string | null } | null

      if (!user) {
        throw new Error('User not found')
      }

      if (!user?.twoFactorSecret) {
        throw new Error('2FA not set up')
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token
      })

      if (!verified) {
        throw new Error('Invalid token')
      }

      await client.user.update({
        where: { id: user.id },
        data: { isTwoFactorEnabled: true } as Prisma.UserUncheckedUpdateInput
      })

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