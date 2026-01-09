import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Discord OAuth2 回調處理
 * 1. 接收 Discord 返回的 code
 * 2. 用 code 換取 access_token
 * 3. 用 access_token 將用戶加入 Discord 伺服器
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // 檢查是否有錯誤
    if (error) {
      console.error('❌ Discord OAuth2 錯誤:', error)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=missing_params`
      )
    }

    // 驗證 session（可選，因為我們有 state）
    const session = await getServerSession(authOptions)
    if (session?.user?.id !== state) {
      console.warn('⚠️ State 驗證失敗:', { sessionUserId: session?.user?.id, state })
      // 即使 state 不匹配，也繼續處理（因為用戶可能在不同設備上）
    }

    const clientId = process.env.DISCORD_CLIENT_ID
    const clientSecret = process.env.DISCORD_CLIENT_SECRET
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/api/discord/callback`
    const botToken = process.env.DISCORD_BOT_TOKEN
    const guildId = process.env.DISCORD_GUILD_ID

    if (!clientId || !clientSecret || !botToken || !guildId) {
      console.error('❌ Discord 配置缺失:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasBotToken: !!botToken,
        hasGuildId: !!guildId,
      })
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=config_missing`
      )
    }

    // 步驟 1: 用 code 換取 access_token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ 獲取 Discord access_token 失敗:', errorText)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=token_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('❌ 未獲取到 access_token')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=no_token`
      )
    }

    // 步驟 2: 獲取用戶的 Discord ID
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('❌ 獲取 Discord 用戶資訊失敗:', errorText)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=user_info_failed`
      )
    }

    const discordUser = await userResponse.json()
    const discordUserId = discordUser.id

    // 步驟 3: 將用戶加入 Discord 伺服器
    const joinResponse = await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${discordUserId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
        }),
      }
    )

    if (!joinResponse.ok) {
      const errorText = await joinResponse.text()
      console.error('❌ 加入 Discord 伺服器失敗:', errorText)
      
      // 如果用戶已經在伺服器中，也算成功
      if (joinResponse.status === 204) {
        // 204 No Content 表示成功（用戶已在伺服器中）
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-success?already_member=true`
        )
      }

      // 檢查是否是因為用戶已經在伺服器中
      if (joinResponse.status === 400) {
        const errorData = await joinResponse.json().catch(() => ({}))
        if (errorData.code === 50007) {
          // 用戶已經在伺服器中
          return NextResponse.redirect(
            `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-success?already_member=true`
          )
        }
      }

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=join_failed`
      )
    }

    // 成功加入伺服器
    console.log(`✅ 用戶 ${discordUserId} 已成功加入 Discord 伺服器`)
    
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-success`
    )
  } catch (error: any) {
    console.error('❌ Discord OAuth2 回調處理失敗:', error)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'https://peiplay.vercel.app'}/auth/discord-error?error=unknown`
    )
  }
}
