import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, tokenStore } from '../api/client'
import { api } from '../api/endpoints'
import type { Me } from '../types'

interface AuthState {
  user: Me | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  register: (body: { username: string; email: string; password: string; display_name: string }) => Promise<void>
  demo: () => Promise<void>
  logout: () => void
  setUser: (user: Me) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    // Restore the session. Only a 401 means the token is bad (the API client clears it). A network blip or a
    // slow serverless cold start must not log anyone out, so those get a few retries and the token is kept.
    const restore = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const me = await api.me()
          if (!cancelled) setUser(me)
          break
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) break
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
        }
      }
      if (!cancelled) setLoading(false)
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('crux:logout', onLogout)
    return () => window.removeEventListener('crux:logout', onLogout)
  }, [])

  const accept = useCallback((out: { access_token: string; user: Me }) => {
    tokenStore.set(out.access_token)
    setUser(out.user)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (login, password) => accept(await api.login(login, password)),
      register: async (body) => accept(await api.register(body)),
      demo: async () => accept(await api.demo()),
      logout: () => {
        tokenStore.clear()
        setUser(null)
      },
      setUser,
    }),
    [user, loading, accept],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
