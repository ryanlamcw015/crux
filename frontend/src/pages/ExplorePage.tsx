import { CloudRain, Droplets, LocateFixed, MapPin, Search, Thermometer, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/endpoints'
import { AreaMap } from '../components/AreaMap'
import { Button, Card, Chip, EmptyState, ErrorState, PageHeader, ScorePill, Segmented, Skeleton, stagger } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useGeolocation } from '../hooks/useGeolocation'
import { useMeta } from '../hooks/useMeta'
import { useUnits } from '../hooks/useUnits'
import { cx } from '../lib/format'

type Sort = 'score' | 'distance' | 'name'

export function ExplorePage() {
  const meta = useMeta()
  const navigate = useNavigate()
  const { temp, distance } = useUnits()
  const geo = useGeolocation()
  const [q, setQ] = useState('')
  const [rock, setRock] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('score')
  const [hovered, setHovered] = useState<number | null>(null)

  const { data: areas, error, loading, reload } = useApi(
    () =>
      api.areas({
        rock_type: rock ?? undefined,
        lat: geo.coords?.lat,
        lon: geo.coords?.lon,
        radius_km: geo.coords ? 1500 : undefined,
        sort: sort === 'distance' && !geo.coords ? 'score' : sort,
      }),
    [rock, sort, geo.coords],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (areas ?? []).filter((a) => !needle || `${a.name} ${a.region}`.toLowerCase().includes(needle))
  }, [areas, q])

  const points = filtered.map((a) => ({
    id: a.id,
    name: a.name,
    lat: a.lat,
    lon: a.lon,
    score: a.conditions?.score ?? null,
    subtitle: `${a.region} · ${a.rock_type}`,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Explore"
        title="Where should you climb?"
        subtitle="Every destination ranked by its live Conditions Score. Hover the list to find it on the map, and click through for the 72-hour outlook."
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search areas or states…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={sort}
            onChange={(v) => {
              if (v === 'distance' && !geo.coords) geo.locate()
              setSort(v)
            }}
            options={[
              { value: 'score', label: 'Best now' },
              { value: 'distance', label: 'Nearest' },
              { value: 'name', label: 'A–Z' },
            ]}
          />
          {geo.coords ? (
            <Button variant="secondary" size="sm" icon={<X className="size-3.5" />} onClick={() => { geo.clear(); setSort('score') }}>
              Within 1,500 km
            </Button>
          ) : (
            <Button variant="secondary" size="sm" loading={geo.locating} icon={<LocateFixed className="size-3.5" />} onClick={geo.locate}>
              Near me
            </Button>
          )}
        </div>
      </div>
      {geo.error && <p className="-mt-3 mb-4 text-xs text-score-poor">{geo.error}</p>}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Chip active={rock === null} onClick={() => setRock(null)}>All rock</Chip>
        {meta &&
          Object.entries(meta.rock_types).map(([key, r]) => (
            <Chip key={key} active={rock === key} onClick={() => setRock(rock === key ? null : key)}>
              {r.label}
            </Chip>
          ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        <div className="order-2 lg:order-1">
          {error && <ErrorState message={error} onRetry={reload} />}
          {loading && !areas && (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          )}
          {areas && filtered.length === 0 && (
            <Card>
              <EmptyState icon={<MapPin className="size-6" />} title="No areas match" body="Try a different search or rock type." />
            </Card>
          )}
          <motion.div
            key={`${rock}-${sort}-${geo.coords?.lat}`}
            className={cx('space-y-3 transition-opacity', loading && areas && 'opacity-60')}
            variants={stagger.container}
            initial="hidden"
            animate="show"
          >
            {filtered.map((a, i) => (
              <Card
                key={a.id}
                hover
                variants={stagger.item}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}
                className={cx(hovered === a.id && 'border-chalk/30 bg-ink-800/70')}
              >
                <Link to={`/areas/${a.id}`} className="flex items-center gap-4 p-4">
                  <span className="w-6 text-center font-display text-sm font-bold text-ink-600">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{a.name}</div>
                    <div className="mt-0.5 truncate text-xs capitalize text-ink-400">
                      {a.region} · {a.rock_type} · {a.route_count.toLocaleString()} routes
                      {a.distance_km !== null && ` · ${distance(a.distance_km)}`}
                    </div>
                    {a.conditions && (
                      <div className="mt-2 flex gap-3 text-xs text-ink-300">
                        <span className="flex items-center gap-1"><Thermometer className="size-3.5" />{temp(a.conditions.temp_c)}</span>
                        <span className="flex items-center gap-1"><CloudRain className="size-3.5" />{a.conditions.precip_prob}%</span>
                        {a.conditions.wet && <span className="flex items-center gap-1 text-score-poor"><Droplets className="size-3.5" />Wet</span>}
                      </div>
                    )}
                  </div>
                  <ScorePill score={a.conditions?.score} />
                </Link>
              </Card>
            ))}
          </motion.div>
        </div>
        <div className="order-1 lg:order-2">
          <Card className="sticky top-24 overflow-hidden p-0">
            <AreaMap
              points={points}
              activeId={hovered}
              onHover={setHovered}
              onSelect={(id) => navigate(`/areas/${id}`)}
              className="h-[340px] w-full lg:h-[calc(100vh-8rem)]"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
