import { NextResponse } from 'next/server'

export async function POST() {
  // 測試用，直接回傳一個假圖片網址
  return NextResponse.json({ url: 'https://placehold.co/200x200.png' })
} 