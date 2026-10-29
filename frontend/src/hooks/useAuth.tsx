import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { tokenStore } from '../api/client'
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
    api
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
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
