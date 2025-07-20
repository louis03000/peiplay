'use client'

export default function PartnerHero({ onCTAClick }: { onCTAClick?: () => void }) {
  return (
    <section className="w-full py-16 flex flex-col items-center justify-center text-center">
      <div className="mb-4">
        <span className="inline-block bg-orange-100 text-orange-700 px-4 py-1 rounded-full text-sm font-semibold mb-4">超過 100 位專業遊戲夥伴</span>
      </div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-gray-900 dark:text-white">
        找到最適合你的遊戲夥伴
      </h1>
      <p className="max-w-xl mx-auto text-lg text-gray-600 dark:text-gray-300 mb-8">
        精選各類遊戲高手，立即預約，享受專屬遊戲體驗！
      </p>
      <button
        className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold text-lg shadow-lg hover:scale-105 transition-transform"
        onClick={onCTAClick}
      >
        立即搜尋最適合你的夥伴
      </button>
    </section>
  )
} 