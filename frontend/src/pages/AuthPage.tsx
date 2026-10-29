import { Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ScoreRing } from '../components/ScoreRing'
import { Button, Card } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register, demo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/progress'
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '', display_name: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null)
  const isLogin = mode === 'login'

  if (user) return <Navigate to={from} replace />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy('form')
    try {
      if (isLogin) await login(form.login, form.password)
      else await register({ username: form.username, email: form.email, password: form.password, display_name: form.display_name })
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const tryDemo = async () => {
    setBusy('demo')
    setError(null)
    try {
      await demo()
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <h1 className="text-5xl font-bold leading-tight">
          {isLogin ? 'Welcome back.' : 'Start climbing'}
          <br />
          <span className="text-gradient">{isLogin ? 'Conditions are calling.' : 'smarter today.'}</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-ink-300">
          Live Conditions Scores, a logbook that charts your progression, and a crew to climb with.
        </p>
        <div className="mt-10 flex items-center gap-6">
          <ScoreRing score={87} size={140} />
          <div className="space-y-2 text-sm text-ink-300">
            <div>✓ 17,000 real routes</div>
            <div>✓ Hourly weather and sun modeling</div>
            <div>✓ Grade pyramids and send trends</div>
          </div>
        </div>
      </motion.div>

      <Card initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-md p-8">
        <h2 className="text-2xl font-bold">{isLogin ? 'Log in' : 'Create your account'}</h2>
        <p className="mt-1 text-sm text-ink-300">
          {isLogin ? 'New to Crux? ' : 'Already have an account? '}
          <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-semibold text-chalk hover:underline">
            {isLogin ? 'Sign up' : 'Log in'}
          </Link>
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {isLogin ? (
            <div>
              <label className="label" htmlFor="login">Username or email</label>
              <input id="login" className="input" autoComplete="username" value={form.login} onChange={set('login')} required />
            </div>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="display_name">Name</label>
                <input id="display_name" className="input" autoComplete="name" value={form.display_name} onChange={set('display_name')} required maxLength={60} />
              </div>
              <div>
                <label className="label" htmlFor="username">Username</label>
                <input id="username" className="input" autoComplete="username" value={form.username} onChange={set('username')} required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" title="Letters, numbers and underscores" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
              required
              minLength={isLogin ? undefined : 8}
              maxLength={72}
            />
            {!isLogin && <p className="mt-1 text-xs text-ink-400">At least 8 characters</p>}
          </div>
          {error && <p className="rounded-lg bg-score-nogo/10 px-3 py-2 text-sm text-score-nogo">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy === 'form'}>
            {isLogin ? 'Log in' : 'Create account'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-400">
          <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
        </div>
        <Button variant="secondary" size="lg" className="w-full" onClick={tryDemo} loading={busy === 'demo'} icon={<Sparkles className="size-4" />}>
          Explore with the demo account
        </Button>
      </Card>
    </div>
  )
}
