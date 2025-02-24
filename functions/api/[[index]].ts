import { ApiErrorResponse } from "../helpers"

export const onRequest: PagesFunction = async (context) => {
  return ApiErrorResponse(404, 'Not found')
}
