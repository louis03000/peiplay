import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * 獲取 Discord OAuth2 授權 URL
 * 用於讓用戶一鍵加入 Discord 伺服器
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const clientId = process.env.DISCORD_CLIENT_ID
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/api/discord/callback`

    if (!clientId) {
      return NextResponse.json({ error: 'Discord OAuth2 未配置' }, { status: 500 })
    }

    // 構建 Discord OAuth2 授權 URL
    const scopes = ['identify', 'guilds.join']
    const state = session.user.id // 使用用戶 ID 作為 state，用於驗證

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
