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

export default async function Home() {
  const featuredPartners = await getFeaturedPartners()

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Hero Section */}
      <div className="relative bg-indigo-800">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-bg.jpg"
            alt="背景圖片"
            fill
            className="object-cover opacity-20"
            priority
          />
        </div>
        <div className="relative max-w-7xl mx-auto py-24 px-4 sm:py-32 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            陪玩預約系統
          </h1>
          <p className="mt-6 text-xl text-indigo-100 max-w-3xl">
            找到最適合您的遊戲夥伴，享受愉快的遊戲時光。專業的陪玩服務，讓您的遊戲體驗更加精彩。
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">夥伴列表</h3>
              <p className="mt-1 text-sm text-gray-500">
                瀏覽所有可用的遊戲夥伴，查看他們的專長和評價
              </p>
              <div className="mt-4">
                <Link
                  href="/partners"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  查看夥伴
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">預約系統</h3>
              <p className="mt-1 text-sm text-gray-500">
                立即預約您喜歡的遊戲夥伴，選擇合適的時間和遊戲
              </p>
              <div className="mt-4">
                <Link
                  href="/booking"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  開始預約
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">加入我們</h3>
              <p className="mt-1 text-sm text-gray-500">
                成為我們的遊戲夥伴，分享您的遊戲技巧和熱情
              </p>
              <div className="mt-4">
                <Link
                  href="/join"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  申請加入
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Partners Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              熱門夥伴
            </h2>
            <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
              這些是我們最受歡迎的遊戲夥伴
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPartners.map((partner: PartnerWithSchedules) => (
              <div
                key={partner.id}
                className="bg-white overflow-hidden shadow rounded-lg"
              >
                <div className="relative h-48">
                  <Image
                    src={partner.coverImage || '/images/placeholder.jpg'}
                    alt={partner.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {partner.name}
                  </h3>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      可預約
                    </span>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900">擅長遊戲</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {partner.games.map((game: string) => (
                        <span
                          key={game}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {game}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      每小時 {partner.hourlyRate} 元
                    </p>
                  </div>
                  <div className="mt-4">
                    <Link
                      href={`/booking?partnerId=${partner.id}`}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      立即預約
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-indigo-700">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">準備好開始遊戲了嗎？</span>
            <span className="block">立即預約您的遊戲夥伴</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-indigo-200">
            選擇您喜歡的遊戲夥伴，開始一段精彩的遊戲之旅
          </p>
          <Link
            href="/booking"
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 sm:w-auto"
          >
            開始預約
          </Link>
        </div>
      </div>
    </main>
  )
}
