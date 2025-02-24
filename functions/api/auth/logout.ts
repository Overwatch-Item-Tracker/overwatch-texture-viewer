import type { Env } from "../../types"

export const onRequestPost: PagesFunction<Env> = async () => {
  const headers = new Headers()
  headers.append('Set-Cookie', 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict')
  headers.append('Location', '/')

  return new Response(null, { status: 302, headers })
}
