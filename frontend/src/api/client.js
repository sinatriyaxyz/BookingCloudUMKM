const BASE = '/api'
export const TOKEN_KEY = 'token'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const headers = {}
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let url = BASE + path
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== '' && v != null),
    ).toString()
    if (qs) url += `?${qs}`
  }
  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Tidak dapat terhubung ke server.')
  }
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    localStorage.removeItem(TOKEN_KEY)
    window.location.assign('/owner/login')
  }
  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    /* tanpa body */
  }
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.code || 'ERROR', e?.message || 'Terjadi kesalahan.')
  }
  return data
}

