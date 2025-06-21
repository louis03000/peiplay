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