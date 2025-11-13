export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import type { Prisma } from '@prisma/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { email: session.user.email }
      }) as { id: string; email: string; isTwoFactorEnabled: boolean; twoFactorSecret: string | null } | null

      if (!user) {
        throw new Error('User not found')
      }

      if (user.isTwoFactorEnabled) {
        throw new Error('2FA already enabled')
      }

      const secret = speakeasy.generateSecret({
        name: `PeiPlay:${user.email}`
      })

      const qrCode = await QRCode.toDataURL(secret.otpauth_url!)

      await client.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret.base32,
          isTwoFactorEnabled: false // Will be enabled after verification
        } as Prisma.UserUpdateInput
      })

      return {
        secret: secret.base32,
        qrCode
      }
    }, '2fa/setup')

    return NextResponse.json(result)
  } catch (error) {
    console.error('2FA setup error:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const status = errorMessage.includes('not found') ? 404 :
                   errorMessage.includes('already enabled') ? 400 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
} 