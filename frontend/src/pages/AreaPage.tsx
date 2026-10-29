import { ChevronLeft, Compass as CompassIcon, Handshake, Layers, Search } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api/endpoints'
import { AreaMap } from '../components/AreaMap'
import { ConditionsPanel } from '../components/ConditionsPanel'
import { Button, Card, ErrorState, ScorePill, Skeleton, stagger } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { compass } from '../lib/format'

export function AreaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: area, error, reload } = useApi(() => api.area(Number(id)), [id])

  if (error) return <div className="mx-auto max-w-7xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>
  if (!area) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to="/explore" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-300 hover:text-white">
        <ChevronLeft className="size-4" /> All areas
      </Link>

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-chalk/80">
            {area.region}
            <span className="text-ink-600">•</span>
            <span className="capitalize">{area.rock_type}</span>
          </div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-bold sm:text-5xl">
            {area.name}
          </motion.h1>
          <p className="mt-3 max-w-2xl text-ink-300">{area.description}</p>
          <div className="mt-3 flex gap-4 text-sm text-ink-400">
            <span>{area.crag_count} crags</span>
            <span>{area.route_count.toLocaleString()} routes</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/routes?area_id=${area.id}`}>
            <Button variant="secondary" icon={<Search className="size-4" />}>Browse routes</Button>
          </Link>
          <Link to={`/partners?area_id=${area.id}`}>
            <Button icon={<Handshake className="size-4" />}>Find a partner</Button>
          </Link>
        </div>
      </div>

      <ConditionsPanel forecast={area.forecast} />

      <div className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <Layers className="size-5 text-chalk" />
          <h2 className="text-2xl font-bold">Crags</h2>
          <span className="text-sm text-ink-400">scored with each wall's own aspect when known</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <motion.div className="grid gap-3 sm:grid-cols-2" variants={stagger.container} initial="hidden" animate="show">
            {area.crags.map((c) => (
              <Card key={c.id} hover variants={stagger.item} whileHover={{ y: -2 }}>
                <Link to={`/crags/${c.id}`} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                      <span>{c.route_count} routes</span>
                      <span className="flex items-center gap-1">
                        <CompassIcon className="size-3" />
                        {c.aspect_deg === null ? 'aspect ?' : `faces ${compass(c.aspect_deg)}`}
                      </span>
                    </div>
                  </div>
                  <ScorePill score={c.conditions?.score} />
                </Link>
              </Card>
            ))}
          </motion.div>
          <Card className="h-[420px] overflow-hidden p-0 lg:sticky lg:top-24">
            <AreaMap
              className="h-full w-full"
              points={area.crags.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, score: c.conditions?.score ?? null, subtitle: `${c.route_count} routes` }))}
              onSelect={(cragId) => navigate(`/crags/${cragId}`)}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
