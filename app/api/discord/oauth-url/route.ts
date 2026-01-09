import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

/**
 * 獲取 Discord OAuth2 授權 URL
 * 用於讓用戶一鍵加入 Discord 伺服器
 * 支持兩種方式：
 * 1. 已登入用戶：使用 session.user.id
 * 2. 未登入用戶：通過 email 參數查找用戶 ID（用於驗證郵件成功後）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    
    const session = await getServerSession(authOptions)
    let userId: string | null = session?.user?.id || null

    // 如果未登入但有 email 參數，嘗試通過 email 查找用戶 ID
    if (!userId && email) {
      try {
        const user = await db.query(async (client) => {
          return await client.user.findUnique({
            where: { email },
            select: { id: true, emailVerified: true },
          })
        }, 'discord/oauth-url:get-user-by-email')

        if (user && user.emailVerified) {
          userId = user.id
        }
      } catch (error) {
        console.error('❌ 通過 email 查找用戶失敗:', error)
      }
    }

    if (!userId) {
      return NextResponse.json({ error: '請先登入或提供有效的 email' }, { status: 401 })
    }

    const clientId = process.env.DISCORD_CLIENT_ID
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/api/discord/callback`

    if (!clientId) {
      return NextResponse.json({ error: 'Discord OAuth2 未配置' }, { status: 500 })
    }

    // 構建 Discord OAuth2 授權 URL
    const scopes = ['identify', 'guilds.join']
    const state = userId // 使用用戶 ID 作為 state，用於驗證

    const oauthUrl = new URL('https://discord.com/oauth2/authorize')
    oauthUrl.searchParams.set('client_id', clientId)
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('response_type', 'code')
    oauthUrl.searchParams.set('scope', scopes.join(' '))
    oauthUrl.searchParams.set('state', state)

    return NextResponse.json({
      oauthUrl: oauthUrl.toString(),
    })
  } catch (error: any) {
    console.error('❌ 獲取 Discord OAuth URL 失敗:', error)
    return NextResponse.json(
      { error: '獲取 Discord OAuth URL 失敗' },
      { status: 500 }
    )
  }
}
