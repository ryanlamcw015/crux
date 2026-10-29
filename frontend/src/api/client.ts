// Thin wrapper around fetch: adds the base URL, the login token, JSON handling and readable errors.

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

const TOKEN_KEY = 'crux_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL + path)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) {
      const field = Array.isArray(detail[0].loc) ? detail[0].loc[detail[0].loc.length - 1] : ''
      return `${field ? field + ': ' : ''}${detail[0].msg}`
    }
  }
  return fallback
}

export async function request<T>(
  method: string,
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let resp: Response
  try {
    resp = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Can't reach the Crux server. Is the backend running?")
  }

  if (resp.status === 204) return undefined as T
  const body: unknown = await resp.json().catch(() => null)
  if (!resp.ok) {
    if (resp.status === 401 && token) {
      tokenStore.clear()
      window.dispatchEvent(new Event('crux:logout'))
    }
    throw new ApiError(resp.status, errorMessage(body, `Request failed (${resp.status})`))
  }
  return body as T
}
