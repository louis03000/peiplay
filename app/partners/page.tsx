import Link from 'next/link'
import Image from 'next/image'
import { PrismaClient } from '@prisma/client'
import { useState } from 'react'

const prisma = new PrismaClient()

async function getPartners() {
  return await prisma.partner.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export default async function PartnersPage() {
  const partners = await getPartners()

  // 前端搜尋狀態
  // 注意：Next.js 14 app router 頁面預設為 server component，若要互動搜尋可拆分 client component

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            遊戲夥伴列表
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            選擇您喜歡的遊戲夥伴，開始預約吧！
          </p>
        </div>

        <div className="mt-8 mb-8 flex justify-center">
          <form className="w-full max-w-lg flex gap-2">
            {/* 搜尋欄位之後可用 client component 實作 */}
            <input
              type="text"
              name="q"
              placeholder="搜尋姓名或遊戲..."
              className="flex-1 px-4 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              disabled
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md"
              disabled
            >
              搜尋
            </button>
          </form>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner: any) => (
            <div key={partner.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="relative h-48">
                <Image
                  src={partner.coverImage || '/images/placeholder.svg'}
                  alt={partner.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900">{partner.name}</h3>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    可預約
                  </span>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900">擅長遊戲</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {partner.games.map((game: string) => (
                      <span key={game} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {game}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-500">每小時 {partner.hourlyRate} 元</p>
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
  )
} 