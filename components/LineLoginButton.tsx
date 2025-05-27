'use client'

import { signIn } from 'next-auth/react'
import Image from 'next/image'

export default function LineLoginButton() {
  return (
    <button
      onClick={() => signIn('line')}
      className="flex items-center justify-center w-full px-4 py-2 text-white bg-[#06C755] rounded-lg hover:bg-[#05a548] transition-colors"
    >
      <Image
        src="/images/line-ar21.svg"
        alt="LINE"
        width={24}
        height={24}
        className="mr-2"
      />
      使用 LINE 登入
    </button>
  )
} 