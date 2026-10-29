import { Loader2 } from 'lucide-react'
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { useAuth } from './hooks/useAuth'
import { LandingPage } from './pages/LandingPage'

// Code splitting: each page downloads only when it's first visited.
function page<K extends string, P extends object>(load: () => Promise<Record<K, ComponentType<P>>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}
const AreaPage = page(() => import('./pages/AreaPage'), 'AreaPage')
const AuthPage = page(() => import('./pages/AuthPage'), 'AuthPage')
const CragPage = page(() => import('./pages/CragPage'), 'CragPage')
const ExplorePage = page(() => import('./pages/ExplorePage'), 'ExplorePage')
const FeedPage = page(() => import('./pages/FeedPage'), 'FeedPage')
const LogbookPage = page(() => import('./pages/LogbookPage'), 'LogbookPage')
const NotFoundPage = page(() => import('./pages/NotFoundPage'), 'NotFoundPage')
const PartnersPage = page(() => import('./pages/PartnersPage'), 'PartnersPage')
const PeoplePage = page(() => import('./pages/PeoplePage'), 'PeoplePage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')
const ProgressPage = page(() => import('./pages/ProgressPage'), 'ProgressPage')
const RoutesPage = page(() => import('./pages/RoutesPage'), 'RoutesPage')

function Spinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-chalk" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

const authed = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="areas/:id" element={<AreaPage />} />
          <Route path="crags/:id" element={<CragPage />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path="logbook" element={authed(<LogbookPage />)} />
          <Route path="progress" element={authed(<ProgressPage />)} />
          <Route path="feed" element={authed(<FeedPage />)} />
          <Route path="partners" element={authed(<PartnersPage />)} />
          <Route path="people" element={authed(<PeoplePage />)} />
          <Route path="u/:username" element={authed(<ProfilePage />)} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
