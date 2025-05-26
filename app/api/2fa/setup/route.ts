export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import type { Prisma } from '@prisma/client'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    }) as { id: string; email: string; isTwoFactorEnabled: boolean; twoFactorSecret: string | null } | null

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.isTwoFactorEnabled) {
      return NextResponse.json({ error: '2FA already enabled' }, { status: 400 })
    }

    const secret = speakeasy.generateSecret({
      name: `PeiPlay:${user.email}`
    })

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret.base32,
        isTwoFactorEnabled: false // Will be enabled after verification
      } as Prisma.UserUpdateInput
    })

    return NextResponse.json({
      secret: secret.base32,
      qrCode
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 