import type { Env } from '../../types'

export const onRequestGet: PagesFunction<Env> = async (context) => {
	const { request, env } = context
	const url = new URL(request.url)

	return Response.redirect(getDiscordLoginUrl(url.origin, env.DISCORD_CLIENT_ID))
}

function getDiscordLoginUrl(origin: string, clientId: string) {
	const redirectUri = encodeURIComponent(`${origin}/api/auth/discord_login`)
	return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify+guilds`
}
