import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendEmailVerificationCode } from '@/lib/email'

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { email, password, name, birthday, phone, discord } = data

    // 檢查郵箱是否已被註冊
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '此郵箱已被註冊' },
        { status: 400 }
      )
    }

    // 檢查年齡限制（18歲以上）
    const today = new Date();
    const birthDate = new Date(birthday);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // 如果還沒到生日，年齡減1
    const actualAge = (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) 
      ? age - 1 
      : age;
    
    if (actualAge < 18) {
      return NextResponse.json(
        { error: '您必須年滿18歲才能註冊' },
        { status: 400 }
      )
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10)

    // 生成 6 位數驗證碼
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 設定過期時間（10分鐘後）
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 創建用戶（但 emailVerified 為 false）
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        birthday: new Date(birthday),
        phone,
        discord,
        role: 'CUSTOMER',
        emailVerified: false,
        emailVerificationCode: verificationCode,
        emailVerificationExpires: expiresAt,
      },
    })

    // 發送驗證碼 Email
    const emailSent = await sendEmailVerificationCode(
      email,
      name,
      verificationCode
    );

    if (!emailSent) {
      // 如果發送失敗，刪除剛創建的用戶
      await prisma.user.delete({
        where: { id: user.id }
      });
      
      return NextResponse.json(
        { error: '發送驗證碼失敗，請稍後再試' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: '註冊成功，請檢查您的 Email 並完成驗證',
      email: email 
    })
  } catch (error) {
    console.error('Error registering user:', error)
    return NextResponse.json(
      { error: '註冊失敗' },
      { status: 500 }
    )
  }
}

// 新增這段
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}