import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { $Enums } from '@prisma/client'


export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined
    const where: any = status ? { status } : {};
    const partners = await prisma.partner.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(partners)
  } catch (error) {
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Admin partners GET error:', error, stack);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error), stack }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '未授權' }, { status: 403 })
  }
  const { id, status } = await request.json()
  if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
  }
  const partner = await prisma.partner.update({
    where: { id },
    data: { status },
    include: { user: true },
  });
  return NextResponse.json(partner);
} 