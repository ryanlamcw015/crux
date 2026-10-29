import { Award, BookOpen, CalendarDays, Flame, Mountain, Sparkles, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/endpoints'
import { GradePyramid, SendTrend, StyleDonut } from '../components/charts'
import { Button, Card, EmptyState, ErrorState, PageHeader, ScorePill, Segmented, Skeleton, StatTile, stagger } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useUnits } from '../hooks/useUnits'
import { formatDay } from '../lib/format'

export function ProgressPage() {
  const { user } = useAuth()
  const { temp } = useUnits()
  const [system, setSystem] = useState<'route' | 'boulder'>('route')
  const { data: stats, error, reload } = useApi(() => api.analytics(), [])
  const { data: areas } = useApi(() => api.areas({ sort: 'score' }), [])
  const home = areas?.find((a) => a.id === user?.home_area?.id)
  const best = areas?.[0]

  if (error) return <div className="mx-auto max-w-7xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>

  const firstName = user?.display_name.split(' ')[0]

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Progression"
        title={<>Hey {firstName}, <span className="text-gradient">keep climbing.</span></>}
        subtitle="Your grade pyramid, send trends and personal bests, all built from your logbook."
        actions={<Link to="/logbook"><Button icon={<BookOpen className="size-4" />}>Open logbook</Button></Link>}
      />

      {user?.is_demo && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start gap-3 rounded-2xl border border-sky/25 bg-sky/[0.07] px-4 py-3 text-sm text-ink-200">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-sky" />
          You're in the demo account: a fictional climber with 14 months of history on real routes. Log a climb, give kudos or post in Partners. Everything works.
        </motion.div>
      )}

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : stats.totals.ascents === 0 ? (
        <Card>
          <EmptyState
            icon={<TrendingUp className="size-6" />}
            title="Your charts are waiting"
            body="Log a few climbs and your grade pyramid and send trends appear here."
            action={<Link to="/logbook"><Button>Log your first climb</Button></Link>}
          />
        </Card>
      ) : (
        <>
          <motion.div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={stagger.container} initial="hidden" animate="show">
            <StatTile icon={<TrendingUp className="size-4" />} label="Sends" value={stats.totals.sends} sub={`${stats.totals.ascents} climbs logged`} />
            <StatTile icon={<CalendarDays className="size-4" />} label="Days out" value={stats.totals.days} sub={`${stats.totals.outdoor} outdoor · ${stats.totals.gym} gym climbs`} accent="#6cc4ff" />
            <StatTile icon={<Award className="size-4" />} label="Hardest route" value={stats.hardest.route?.grade ?? '–'} sub={stats.hardest.route ? `${stats.hardest.route.name} · ${formatDay(stats.hardest.route.date)}` : 'No route sends yet'} accent="#ff8a4c" />
            <StatTile icon={<Flame className="size-4" />} label="Weekly streak" value={<>{stats.totals.weekly_streak}<span className="ml-1 text-base text-ink-400">wk</span></>} sub={stats.hardest.boulder ? `Hardest boulder ${stats.hardest.boulder.grade}` : 'Climb once a week to keep it alive'} accent="#ff6b8b" />
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Grade pyramid</h3>
                  <p className="text-xs text-ink-400">Sends by grade, split by style</p>
                </div>
                <Segmented value={system} onChange={setSystem} options={[{ value: 'route', label: 'Routes' }, { value: 'boulder', label: 'Boulders' }]} />
              </div>
              <GradePyramid rows={stats.pyramid[system]} boulder={system === 'boulder'} />
            </Card>
            <Card className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
              <div className="mb-5">
                <h3 className="text-lg font-semibold">Send trend</h3>
                <p className="text-xs text-ink-400">Sends per month · <span className="text-chalk">hardest {system === 'boulder' ? 'boulder' : 'route'} that month</span></p>
              </div>
              <SendTrend rows={stats.trend} system={system === 'boulder' ? 'v' : 'yds'} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h3 className="mb-5 text-lg font-semibold">How you send</h3>
              <StyleDonut styles={stats.styles} />
            </Card>
            <Card className="p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
              <h3 className="mb-4 text-lg font-semibold">Last 90 days</h3>
              <div className="space-y-3">
                {(['route', 'boulder'] as const).map((k) => {
                  const recent = stats.hardest_recent[k]
                  const all = stats.hardest[k]
                  return (
                    <div key={k} className="rounded-xl border border-white/5 bg-ink-950/40 p-4">
                      <div className="text-xs uppercase tracking-wider text-ink-400">Hardest {k}</div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="font-display text-2xl font-bold">{recent?.grade ?? '–'}</span>
                        {recent && all && recent.grade === all.grade && <span className="text-xs font-semibold text-chalk">All-time best!</span>}
                      </div>
                      <div className="truncate text-xs text-ink-400">{recent ? recent.name : 'Nothing logged recently'}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
            <Card className="relative overflow-hidden p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
              <div className="absolute -right-12 -top-12 size-40 rounded-full bg-chalk/10 blur-3xl" />
              <h3 className="mb-4 text-lg font-semibold">Where to climb next</h3>
              {[home && { tag: 'Your home crag', area: home }, best && best.id !== home?.id && { tag: 'Best conditions anywhere', area: best }]
                .filter((x): x is { tag: string; area: NonNullable<typeof best> } => Boolean(x))
                .map(({ tag, area }) => (
                  <Link key={area.id} to={`/areas/${area.id}`} className="mb-3 block rounded-xl border border-white/5 bg-ink-950/40 p-4 transition hover:border-chalk/30">
                    <div className="text-xs uppercase tracking-wider text-ink-400">{tag}</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-semibold"><Mountain className="size-4 text-chalk" />{area.name}</span>
                      <ScorePill score={area.conditions?.score} />
                    </div>
                    {area.conditions && <div className="mt-1 text-xs text-ink-400">{temp(area.conditions.temp_c)} · {area.conditions.precip_prob}% rain</div>}
                  </Link>
                ))}
              {!areas && <Skeleton className="h-20" />}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
