import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import type { Prisma } from '@prisma/client'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = speakeasy.generateSecret({
      name: `PeiPlay:${session.user.email}`
    })

    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret.base32 } as Prisma.UserUncheckedUpdateInput
    })

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!)

    return NextResponse.json({
      secret: secret.base32,
      qrCode
    })
  } catch (error) {
    console.error('Error setting up 2FA:', error)
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    )
  }
} 