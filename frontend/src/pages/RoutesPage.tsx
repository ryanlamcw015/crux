import { Plus, Search, SearchX } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api/endpoints'
import { LogAscentModal } from '../components/LogAscentModal'
import { Button, Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, Toast, useToast } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useMeta } from '../hooks/useMeta'
import { DISCIPLINE_LABEL } from '../lib/format'
import type { Discipline, Route } from '../types'

const PAGE = 40

export function RoutesPage() {
  const meta = useMeta()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const areaId = params.get('area_id') ? Number(params.get('area_id')) : undefined
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [discipline, setDiscipline] = useState<Discipline | null>(null)
  const [gradeMin, setGradeMin] = useState('')
  const [gradeMax, setGradeMax] = useState('')
  const [extra, setExtra] = useState<Route[]>([])
  const [more, setMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [logRoute, setLogRoute] = useState<Route | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data: areas } = useApi(() => api.areas({ sort: 'name' }), [])
  const query = {
    q: debounced || undefined,
    area_id: areaId,
    discipline: discipline ?? undefined,
    grade_min: gradeMin || undefined,
    grade_max: gradeMax || undefined,
    limit: PAGE,
  }
  const { data: routes, error, loading, reload } = useApi(() => api.routes(query), [debounced, areaId, discipline, gradeMin, gradeMax])

  useEffect(() => {
    setExtra([])
    setMore((routes?.length ?? 0) === PAGE)
  }, [routes])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = await api.routes({ ...query, offset: (routes?.length ?? 0) + extra.length })
      setExtra((e) => [...e, ...next])
      setMore(next.length === PAGE)
    } finally {
      setLoadingMore(false)
    }
  }

  const grades = meta ? meta.grades[discipline === 'boulder' ? 'v' : 'yds'] : []
  const all = [...(routes ?? []), ...extra]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Route finder" title="Find your next project" subtitle="Search 17,000 routes and problems from OpenBeta by name, area, style and grade." />

      <Card className="mb-6 space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-400" />
            <input className="input pl-9" placeholder="Route name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select
            className="input"
            value={areaId ?? ''}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('area_id', e.target.value)
              else next.delete('area_id')
              setParams(next, { replace: true })
            }}
          >
            <option value="">All areas</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!discipline} onClick={() => { setDiscipline(null); setGradeMin(''); setGradeMax('') }}>All styles</Chip>
          {(['sport', 'trad', 'boulder', 'tr'] as Discipline[]).map((d) => (
            <Chip
              key={d}
              active={discipline === d}
              onClick={() => {
                const next = discipline === d ? null : d
                if ((next === 'boulder') !== (discipline === 'boulder')) {
                  setGradeMin('')
                  setGradeMax('')
                }
                setDiscipline(next)
              }}
            >
              {DISCIPLINE_LABEL[d]}
            </Chip>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-400">
            Grade
            <select className="input h-8 w-24 py-1 text-xs" value={gradeMin} onChange={(e) => setGradeMin(e.target.value)}>
              <option value="">min</option>
              {grades.map((g) => <option key={g}>{g}</option>)}
            </select>
            –
            <select className="input h-8 w-24 py-1 text-xs" value={gradeMax} onChange={(e) => setGradeMax(e.target.value)}>
              <option value="">max</option>
              {grades.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !routes && <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
      {routes && all.length === 0 && (
        <Card><EmptyState icon={<SearchX className="size-6" />} title="No routes found" body="Loosen the filters or try another name." /></Card>
      )}
      {all.length > 0 && (
        <Card className={`overflow-hidden p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="divide-y divide-white/5">
            {all.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min((i % PAGE) * 0.012, 0.3) }}
                className="group flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03]"
              >
                <span className="w-16 shrink-0 font-display font-bold text-chalk">{r.grade}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-xs text-ink-400">
                    <Link to={`/crags/${r.crag_id}`} className="hover:text-white">{r.crag_name}</Link> ·{' '}
                    <Link to={`/areas/${r.area_id}`} className="hover:text-white">{r.area_name}</Link> · {DISCIPLINE_LABEL[r.discipline]}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => (user ? setLogRoute(r) : navigate('/login', { state: { from: '/routes' } }))}
                >
                  Log
                </Button>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
      {more && all.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore}>Load more</Button>
        </div>
      )}

      <LogAscentModal
        open={logRoute !== null}
        initialRoute={logRoute}
        onClose={() => setLogRoute(null)}
        onSaved={(a) => toast.show(`Logged ${a.name} (${a.grade}) ✓`)}
      />
      <Toast message={toast.message} />
    </div>
  )
}
