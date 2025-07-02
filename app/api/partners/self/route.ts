import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ partner: null })
  }
  const partner = await prisma.partner.findUnique({
    where: { userId: session.user.id }
  })
  return NextResponse.json({ partner })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { isAvailableNow, isRankBooster, rankBoosterNote, rankBoosterRank } = await request.json();
  const partner = await prisma.partner.update({
    where: { userId: session.user.id },
    data: {
      ...(typeof isAvailableNow === 'boolean' ? { isAvailableNow } : {}),
      ...(typeof isRankBooster === 'boolean' ? { isRankBooster } : {}),
      ...(typeof rankBoosterNote === 'string' ? { rankBoosterNote } : {}),
      ...(typeof rankBoosterRank === 'string' ? { rankBoosterRank } : {}),
    },
  })
  return NextResponse.json({ partner })
} 