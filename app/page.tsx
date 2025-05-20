import Link from 'next/link'
import Image from 'next/image'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type PartnerWithSchedules = {
  id: string
  name: string
  birthday: Date
  phone: string
  coverImage: string
  games: string[]
  hourlyRate: number
  schedules: {
    id: string
    date: Date
    startTime: Date
    endTime: Date
    isAvailable: boolean
  }[]
  createdAt: Date
  updatedAt: Date
}

async function getFeaturedPartners(): Promise<PartnerWithSchedules[]> {
  try {
    const partners = await prisma.partner.findMany({
      take: 3, // 只取前3個夥伴作為特色展示
      include: {
        schedules: {
          where: {
            isAvailable: true,
            date: {
              gte: new Date(),
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return partners
  } catch (error) {
    console.error('Error fetching featured partners:', error)
    return []
  }
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-4">PeiPlay 預約平台</h1>
      <p className="text-lg text-gray-300 mb-8">專為顧客與夥伴打造的預約與管理系統。</p>
      </div>
  )
}
