import { BarChart3, BookOpen, Compass, Handshake, Loader2, LogOut, Menu, Mountain, Rss, Search, User as UserIcon, Users, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { useUnits } from '../hooks/useUnits'
import { cx } from '../lib/format'
import { AnimatedBackground } from './AnimatedBackground'
import { ErrorBoundary } from './ErrorBoundary'
import { Avatar, Button } from './ui'

const NAV = [
  { to: '/explore', label: 'Explore', icon: Compass, auth: false },
  { to: '/routes', label: 'Routes', icon: Search, auth: false },
  { to: '/logbook', label: 'Logbook', icon: BookOpen, auth: true },
  { to: '/progress', label: 'Progress', icon: BarChart3, auth: true },
  { to: '/feed', label: 'Feed', icon: Rss, auth: true },
  { to: '/partners', label: 'Partners', icon: Handshake, auth: true },
  { to: '/people', label: 'People', icon: Users, auth: true },
]

const MOBILE_TABS = ['/explore', '/logbook', '/progress', '/feed', '/partners']

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-ember to-chalk shadow-[0_0_24px_-4px_rgba(200,245,96,.6)] transition group-hover:rotate-[-6deg] group-hover:scale-105">
        <Mountain className="size-5 text-ink-950" strokeWidth={2.5} />
      </span>
      <span className="font-display text-xl font-bold tracking-tight">Crux</span>
    </Link>
  )
}

function UnitsToggle() {
  const { units, setUnits } = useUnits()
  return (
    <button
      onClick={() => setUnits(units === 'imperial' ? 'metric' : 'imperial')}
      className="rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-ink-300 transition hover:border-white/20 hover:text-white"
      title="Switch units"
    >
      {units === 'imperial' ? '°F' : '°C'}
    </button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!user) return null
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center rounded-full transition hover:ring-2 hover:ring-chalk/40" aria-label="Account menu">
        <Avatar user={user} size={36} link={false} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="glass absolute right-0 top-12 z-[1100] w-56 bg-ink-900/95 p-1.5"
          >
            <div className="px-3 py-2">
              <div className="truncate text-sm font-semibold">{user.display_name}</div>
              <div className="truncate text-xs text-ink-400">@{user.username}</div>
            </div>
            <div className="my-1 h-px bg-white/5" />
            <button
              onClick={() => {
                setOpen(false)
                navigate(`/u/${user.username}`)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-white/[0.06]"
            >
              <UserIcon className="size-4" /> Your profile
            </button>
            <button
              onClick={() => {
                setOpen(false)
                logout()
                navigate('/')
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-white/[0.06]"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Layout() {
  const { user } = useAuth()
  const location = useLocation()
  const outlet = useOutlet()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = NAV.filter((n) => !n.auth || user)

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground />

      <header className="sticky top-0 z-[900] border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className="relative px-3 py-2 text-sm font-medium">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className={cx('relative transition', isActive ? 'text-white' : 'text-ink-300 hover:text-white')}>{n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <UnitsToggle />
            {user ? (
              <UserMenu />
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Sign up</Button>
                </Link>
              </div>
            )}
            <button className="rounded-lg p-2 text-ink-200 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/5 lg:hidden"
            >
              <div className="grid gap-1 p-3">
                {nav.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    className={({ isActive }) =>
                      cx('flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium', isActive ? 'bg-white/[0.08] text-white' : 'text-ink-300')
                    }
                  >
                    <n.icon className="size-4" /> {n.label}
                  </NavLink>
                ))}
                {!user && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Link to="/login"><Button variant="secondary" className="w-full">Log in</Button></Link>
                    <Link to="/register"><Button className="w-full">Sign up</Button></Link>
                  </div>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className={cx('flex-1', user && 'pb-20 lg:pb-0')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Suspense lives inside the animated wrapper: if it sat above it, loading a lazy page would hide
                the wrapper mid-fade and leave it stuck at opacity 0. */}
            <ErrorBoundary resetKey={location.pathname}>
              <Suspense
                fallback={
                  <div className="flex min-h-[60vh] items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-chalk" />
                  </div>
                }
              >
                {outlet}
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-xs text-ink-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Crux · Climb when it's prime.</span>
          <span>
            Route data <a className="text-ink-300 hover:text-white" href="https://openbeta.io" target="_blank" rel="noreferrer">OpenBeta</a> · Weather{' '}
            <a className="text-ink-300 hover:text-white" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> · Maps ©{' '}
            <a className="text-ink-300 hover:text-white" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
          </span>
        </div>
      </footer>

      {user && (
        <nav className="fixed inset-x-0 bottom-0 z-[900] border-t border-white/[0.08] bg-ink-950/85 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5">
            {NAV.filter((n) => MOBILE_TABS.includes(n.to)).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition', isActive ? 'text-chalk' : 'text-ink-400')
                }
              >
                <n.icon className="size-5" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
