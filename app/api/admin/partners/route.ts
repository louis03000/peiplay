import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { $Enums } from '@prisma/client'

export async function GET(request: Request) {
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
  await prisma.$executeRaw`UPDATE "Partner" SET "status" = ${status} WHERE "id" = ${id}`;
  const partner = await prisma.partner.findUnique({ where: { id }, include: { user: true } });
  return NextResponse.json(partner);
} 