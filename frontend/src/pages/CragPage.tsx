import { ChevronLeft, Navigation, Plus, Search, ShieldAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api/endpoints'
import { ConditionsPanel } from '../components/ConditionsPanel'
import { LogAscentModal } from '../components/LogAscentModal'
import { Button, Card, Chip, ErrorState, Skeleton, Toast, useToast } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { DISCIPLINE_LABEL, compass, cx } from '../lib/format'
import type { Discipline, Route } from '../types'

const DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315]

/** Pick which way the wall faces. This feeds the sun/shade part of the score. */
function AspectPicker({ value, onChange, disabled }: { value: number | null; onChange: (deg: number) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-36 rounded-full border border-white/10 bg-ink-950/50">
        {DIRECTIONS.map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180
          const active = value === deg
          return (
            <button
              key={deg}
              disabled={disabled}
              onClick={() => onChange(deg)}
              className={cx(
                'absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold transition',
                active ? 'bg-chalk text-ink-950 shadow-[0_0_16px_rgba(200,245,96,.6)]' : 'text-ink-300 hover:bg-white/10 hover:text-white',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              style={{ left: `${50 + Math.cos(rad) * 38}%`, top: `${50 + Math.sin(rad) * 38}%` }}
              title={`Faces ${compass(deg)}`}
            >
              {compass(deg)}
            </button>
          )
        })}
        <motion.div
          className="absolute left-1/2 top-1/2 h-12 w-1 origin-bottom rounded-full bg-gradient-to-t from-transparent to-chalk"
          style={{ x: '-50%', y: '-100%' }}
          animate={{ rotate: value ?? 0, opacity: value === null ? 0.15 : 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        />
      </div>
      <div className="text-xs text-ink-400">
        {value === null ? 'Which way does this wall face?' : `Wall faces ${compass(value)}`}
        {disabled && ' · log in to edit'}
      </div>
    </div>
  )
}

export function CragPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: crag, error, reload, setData } = useApi(() => api.crag(Number(id)), [id])
  const [discipline, setDiscipline] = useState<Discipline | null>(null)
  const [q, setQ] = useState('')
  const [logRoute, setLogRoute] = useState<Route | null>(null)
  const toast = useToast()

  const routes = useMemo(
    () =>
      (crag?.routes ?? []).filter(
        (r) => (!discipline || r.discipline === discipline) && (!q || r.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [crag, discipline, q],
  )
  const disciplines = useMemo(() => [...new Set((crag?.routes ?? []).map((r) => r.discipline))], [crag])

  if (error) return <div className="mx-auto max-w-7xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>
  if (!crag) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const setAspect = async (deg: number) => {
    setData({ ...crag, aspect_deg: deg })
    setData(await api.setAspect(crag.id, deg))
  }

  const openLog = (r: Route) => (user ? setLogRoute(r) : navigate('/login', { state: { from: `/crags/${crag.id}` } }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to={`/areas/${crag.area.id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-ink-300 hover:text-white">
        <ChevronLeft className="size-4" /> {crag.area.name}
      </Link>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-chalk/80">
            {crag.area.region} · <span className="capitalize">{crag.rock_type ?? crag.area.rock_type}</span>
          </div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-bold sm:text-5xl">
            {crag.name}
          </motion.h1>
          <div className="mt-2 text-sm text-ink-400">{crag.route_count} routes</div>
        </div>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${crag.lat},${crag.lon}`} target="_blank" rel="noreferrer">
          <Button variant="secondary" icon={<Navigation className="size-4" />}>Directions</Button>
        </a>
      </div>

      <ConditionsPanel forecast={crag.forecast} aside={<AspectPicker value={crag.aspect_deg} onChange={setAspect} disabled={!user} />} />

      <div className="mt-12">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Routes</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-ink-400" />
              <input className="input h-9 w-52 py-1.5 pl-9" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Chip active={!discipline} onClick={() => setDiscipline(null)}>All</Chip>
            {disciplines.map((d) => (
              <Chip key={d} active={discipline === d} onClick={() => setDiscipline(discipline === d ? null : d)}>
                {DISCIPLINE_LABEL[d]}
              </Chip>
            ))}
          </div>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-white/5">
            {routes.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.015, 0.4) }}
                className="group flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.03]"
              >
                <span className="w-16 shrink-0 font-display text-base font-bold text-chalk">{r.grade}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    {DISCIPLINE_LABEL[r.discipline]}
                    {r.safety && (
                      <span className="flex items-center gap-1 text-score-poor">
                        <ShieldAlert className="size-3" /> {r.safety}
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => openLog(r)} className="opacity-80 group-hover:opacity-100">
                  Log
                </Button>
              </motion.div>
            ))}
            {routes.length === 0 && <div className="p-8 text-center text-sm text-ink-400">No routes match.</div>}
          </div>
        </Card>
      </div>

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
