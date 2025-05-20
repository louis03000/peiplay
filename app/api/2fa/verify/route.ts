import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import speakeasy from 'speakeasy'
import type { Prisma } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token } = await request.json()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    const userWithSecret = user as unknown as { twoFactorSecret?: string }

    if (!userWithSecret?.twoFactorSecret) {
      return NextResponse.json(
        { error: '2FA not setup' },
        { status: 400 }
      )
    }

    const verified = speakeasy.totp.verify({
      secret: userWithSecret.twoFactorSecret,
      encoding: 'base32',
      token
    })

    if (verified) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { isTwoFactorEnabled: true } as Prisma.UserUncheckedUpdateInput
      })
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error verifying 2FA:', error)
    return NextResponse.json(
      { error: 'Failed to verify 2FA' },
      { status: 500 }
    )
  }
} 