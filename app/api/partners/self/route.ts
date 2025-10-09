import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ partner: null })
    }
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })
    return NextResponse.json({ partner })
  } catch (error) {
    console.error('Partners self GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { isAvailableNow, isRankBooster, rankBoosterNote, rankBoosterRank, customerMessage, availableNowSince } = await request.json();
    const partner = await prisma.partner.update({
      where: { userId: session.user.id },
      data: {
        ...(typeof isAvailableNow === 'boolean' ? { isAvailableNow } : {}),
        ...(typeof isRankBooster === 'boolean' ? { isRankBooster } : {}),
        ...(typeof rankBoosterNote === 'string' ? { rankBoosterNote } : {}),
        ...(typeof rankBoosterRank === 'string' ? { rankBoosterRank } : {}),
        ...(typeof customerMessage === 'string' ? { customerMessage } : {}),
        ...(availableNowSince !== undefined ? { availableNowSince: availableNowSince ? new Date(availableNowSince) : null } : {}),
      },
    })
    return NextResponse.json({ partner })
  } catch (error) {
    console.error('Partners self PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 