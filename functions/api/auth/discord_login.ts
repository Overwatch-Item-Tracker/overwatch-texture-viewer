import { SignJWT } from 'jose'
import { nanoid } from 'nanoid'
import { ApiErrorResponse, ApiExceptionResponse, ApiResponse } from '../../helpers'
import type { Env, IUserDB } from '../../types'

const DISCORD_API = 'https://discord.com/api/v10'
const DISCORD_GUILD_ID = '570672959799164958'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return ApiErrorResponse(400, 'No code provided')
  }

  try {
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
      }),
    })

    const tokenResult: IDiscordTokenResult = await tokenResponse.json()
    if (isErrorResponse(tokenResponse, tokenResult)) {
      return handleDiscordError(tokenResponse, tokenResult, 'Failed to exchange code for token. Already used?')
    }

    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokenResult.access_token}`,
      },
    })

    const userResult: IDiscordUserResult = await userResponse.json()
    if (isErrorResponse(userResponse, userResult)) {
      return handleDiscordError(userResponse, userResult, 'Failed to get user info')
    }

    const guildResponse = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${tokenResult.access_token}`,
      },
    })

    const guildResults: IDiscordGuildsResult[] | IDiscordResult = await guildResponse.json()
    if (isErrorResponse(guildResponse, guildResults as IDiscordResult)) {
      return handleDiscordError(guildResponse, guildResults as IDiscordResult, 'Failed to get guild info')
    }

    const isInGuild = (guildResults as IDiscordGuildsResult[]).some((guild) => guild.id === DISCORD_GUILD_ID)
    if (!isInGuild) {
      return ApiErrorResponse(403, 'User is not a member of the required Discord server')
    }

    let user = await findUserByDiscordId(env.DB, userResult.id)
    const displayName = getDiscordName(userResult)
    
    if (!user) {
      user = await createUser(env.DB, {
        guid: nanoid(),
        display_name: displayName,
        discord_id: userResult.id,
      })
    } else if (user.display_name !== displayName) {
      await updateUserDisplayName(env.DB, user.id, displayName)
      user.display_name = displayName
    }

    const jwt = await createJWT(user, env.JWT_SECRET)

    const headers = new Headers()
    headers.append('Set-Cookie', `token=${jwt}; Path=/; Secure; SameSite=Strict`)
    headers.append('Location', '/')

    return new Response(null, { status: 302, headers })
  } catch (error) {
    console.error('Auth error:', error)
    return ApiExceptionResponse(error)
  }
}

async function findUserByDiscordId(db: D1Database, discordId: string): Promise<IUserDB | null> {
  const result = await db
    .prepare('SELECT id, guid, display_name, discord_id, is_admin FROM users WHERE discord_id = ?1')
    .bind(discordId)
    .first<IUserDB>()
  
  return result || null
}

async function updateUserDisplayName(db: D1Database, userId: number, displayName: string): Promise<void> {
  await db
    .prepare('UPDATE users SET display_name = ?1 WHERE id = ?2')
    .bind(displayName, userId)
    .run()
}

async function createUser(db: D1Database, user: { guid: string; display_name: string; discord_id: string }): Promise<IUserDB> {
  const result = await db
    .prepare(
      'INSERT INTO users (guid, display_name, discord_id) VALUES (?1, ?2, ?3) RETURNING id, guid, display_name, discord_id, is_admin'
    )
    .bind(user.guid, user.display_name, user.discord_id)
    .first<IUserDB>()

  if (!result) {
    throw new Error('Failed to create user')
  }

  return result
}

async function createJWT(user: IUserDB, secret: string): Promise<string> {
  const jwt = await new SignJWT({
    sub: user.id.toString(),
    guid: user.guid,
    name: user.display_name,
    discord_id: user.discord_id,
    admin: !!user.is_admin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(new TextEncoder().encode(secret))

  return jwt
}

function getDiscordName(user: IDiscordUserResult): string {
  if (user.global_name) {
    return `${user.global_name} (${user.username})`
  }

  return user.username
}

function isErrorResponse(response: Response, result: IDiscordResult): boolean {
  if (!response.ok || result.error) {
    return true
  }

  return false
}

function handleDiscordError(response: Response, result: IDiscordResult, message: string) {
  return ApiResponse(false, { 
    status: response.status,
    message,
    error: result.error,
    error_description: result.error_description
   }, { status: 400 })
}

interface IDiscordResult {
  error?: string
  error_description?: string
}

interface IDiscordTokenResult extends IDiscordResult {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

interface IDiscordUserResult extends IDiscordResult {
  id: string
  username: string
  discriminator: string
  global_name: string | null
  avatar: string | null
}

interface IDiscordGuildsResult {
  id: string
  name: string
}
