export function ApiResponse(ok: boolean, data?: any, options: ResponseInit = {}) {
  const _data = {
    ok,
    ...(data || {})
  }

  return new Response(JSON.stringify(_data), {
    ...(options || {}),
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
      ...(options?.headers || {})
    },
  })
}

export function ApiDataResponse(data?: any) {
  return ApiResponse(!!data, {
    data: data
  })
}

export function ApiErrorResponse(status: number, error: Error | string, data?: any, options: ResponseInit = {}) {
  return ApiResponse(false, {
    message: error instanceof Error ? error.message : error,
    ...(data || {})
  }, { status, ...(options || {}) })
}

export function ApiExceptionResponse(err: Error | any, data?: any, options: ResponseInit = {}) {
  return ApiResponse(false, {
    message: err?.message || "An error occurred",
    ...(data || {})
  }, { status: 500, ...(options || {}) })
}
