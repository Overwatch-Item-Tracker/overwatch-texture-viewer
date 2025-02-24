import { ApiDataResponse, ApiErrorResponse } from '../../helpers'
import type { Env, IJWTAuthPayload } from '../../types'
import { jwtVerify } from 'jose'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const token = request.headers.get('cookie')?.match(/token=([^;]+)/)?.[1]

  if (!token) {
    return ApiErrorResponse(401, 'Not authenticated')
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET))
    const payloadData = payload as unknown as IJWTAuthPayload
    return ApiDataResponse({
      id: payloadData.sub,
      guid: payloadData.guid,
      display_name: payloadData.name,
      discord_id: payloadData.discord_id,
      is_admin: payloadData.admin,
    })
  } catch (error) {
    return ApiErrorResponse(401, 'Invalid token')
  }
}
