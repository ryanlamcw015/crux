import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CloudRain,
  Compass,
  Gauge,
  Handshake,
  Layers,
  Rss,
  Sparkles,
  Sun,
  Thermometer,
} from 'lucide-react'
import { animate, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/endpoints'
import { ScoreRing } from '../components/ScoreRing'
import { Button, Card, Reveal, ScorePill, Skeleton, stagger } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useUnits } from '../hooks/useUnits'

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, to])
  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  )
}

const FEATURES = [
  { icon: Gauge, title: 'Conditions Score', body: 'A 0–100 rating for every crag, hour by hour, from live weather, sun and shade, and how each rock type dries.', color: '#c8f560' },
  { icon: Compass, title: 'Route finder & map', body: '17,000 real routes from OpenBeta. Filter by grade and style, and see which walls are in condition right now.', color: '#6cc4ff' },
  { icon: BookOpen, title: 'Logbook', body: 'Log outdoor sends and gym sessions in seconds: onsight, flash, redpoint, attempts, stars and notes.', color: '#ff8a4c' },
  { icon: BarChart3, title: 'Progression analytics', body: 'Grade pyramids, monthly send trends, hardest sends and streaks. Watch yourself get stronger.', color: '#a78bfa' },
  { icon: Rss, title: 'Friends feed', body: "See what your crew is sending, give kudos, and keep each other psyched.", color: '#ff6b8b' },
  { icon: Handshake, title: 'Partner finder', body: 'Post where and when you want to climb, at a gym or a crag, and match with climbers nearby.', color: '#34d399' },
]

export function LandingPage() {
  const { user, demo } = useAuth()
  const navigate = useNavigate()
  const { temp } = useUnits()
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const { data: areas } = useApi(() => api.areas({ sort: 'score' }), [])
  const best = areas?.[0]
  const routeTotal = areas?.reduce((sum, a) => sum + a.route_count, 0) ?? 17000

  const startDemo = async () => {
    setDemoLoading(true)
    setDemoError(null)
    try {
      await demo()
      navigate('/progress')
    } catch (err) {
      setDemoError((err as Error).message)
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-chalk/25 bg-chalk/[0.07] px-3 py-1.5 text-xs font-medium text-chalk"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-chalk opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-chalk" />
            </span>
            Live conditions for {areas?.length ?? 22} destinations
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl"
          >
            Know exactly
            <br />
            <span className="text-gradient">when to send.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mt-6 max-w-xl text-lg text-ink-300"
          >
            Crux turns weather, sun angle and rock type into a single Conditions Score for every crag, then helps you
            log the send, track your progression and find someone to belay you.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            {user ? (
              <Link to="/progress">
                <Button size="lg" icon={<ArrowRight className="size-5" />}>Open your dashboard</Button>
              </Link>
            ) : (
              <Button size="lg" onClick={startDemo} loading={demoLoading} icon={<Sparkles className="size-5" />}>
                Try the live demo
              </Button>
            )}
            <Link to="/explore">
              <Button size="lg" variant="secondary" icon={<Compass className="size-5" />}>
                Explore conditions
              </Button>
            </Link>
          </motion.div>
          {demoError && <p className="mt-3 text-sm text-score-nogo">{demoError}</p>}
          {!user && <p className="mt-3 text-xs text-ink-400">No signup needed: the demo account comes with a year of logged climbs.</p>}

          <div className="mt-14 grid max-w-lg grid-cols-3 gap-6">
            {[
              { value: routeTotal, label: 'routes', suffix: '' },
              { value: areas?.reduce((s, a) => s + a.crag_count, 0) ?? 800, label: 'crags scored', suffix: '' },
              { value: 72, label: 'hour outlook', suffix: 'h' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl font-bold text-white">
                  <CountUp to={s.value} suffix={s.suffix} />
                </div>
                <div className="text-xs uppercase tracking-wider text-ink-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live preview card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-chalk/20 via-sky/10 to-ember/20 blur-3xl" />
          <Card className="relative p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Best right now</div>
              <span className="flex items-center gap-1.5 text-xs text-ink-400">
                <span className="size-1.5 rounded-full bg-score-prime" /> live
              </span>
            </div>
            {best ? (
              <Link to={`/areas/${best.id}`} className="group flex flex-col items-center gap-6 sm:flex-row">
                <ScoreRing score={best.conditions?.score ?? null} />
                <div className="text-center sm:text-left">
                  <div className="font-display text-2xl font-bold group-hover:text-chalk">{best.name}</div>
                  <div className="text-sm text-ink-300">{best.region}</div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-ink-300 sm:justify-start">
                    <span className="rounded-md bg-white/5 px-2 py-1 capitalize">{best.rock_type}</span>
                    {best.conditions && <span className="rounded-md bg-white/5 px-2 py-1">{temp(best.conditions.temp_c)}</span>}
                    <span className="rounded-md bg-white/5 px-2 py-1">{best.route_count} routes</span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-6">
                <Skeleton className="size-[168px] rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            )}
            <div className="mt-7 space-y-2">
              {(areas ?? []).slice(1, 5).map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.08 }}>
                  <Link
                    to={`/areas/${a.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <span className="text-sm font-medium">{a.name}</span>
                    <ScorePill score={a.conditions?.score} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-chalk/80">Everything in one place</div>
          <h2 className="text-4xl font-bold sm:text-5xl">From forecast to send to <span className="text-gradient-warm">next project</span></h2>
        </Reveal>
        <motion.div
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          variants={stagger.container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {FEATURES.map((f) => (
            <Card key={f.title} hover variants={stagger.item} whileHover={{ y: -4 }} className="group relative overflow-hidden p-6">
              <div
                className="absolute -right-10 -top-10 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `${f.color}30` }}
              />
              <div className="mb-5 inline-flex size-11 items-center justify-center rounded-xl ring-1 ring-white/10" style={{ background: `${f.color}18`, color: f.color }}>
                <f.icon className="size-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-300">{f.body}</p>
            </Card>
          ))}
        </motion.div>
      </section>

      {/* How the score works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Card className="relative overflow-hidden p-8 sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(200,245,96,0.08),transparent_50%)]" />
          <div className="relative grid gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-chalk/80">The model</div>
              <h2 className="text-3xl font-bold sm:text-4xl">How the Conditions Score works</h2>
              <p className="mt-4 text-ink-300">
                Every hour, Crux pulls a fresh forecast from Open-Meteo, including the last two days of rain. It runs a drying
                model tuned to each rock type, works out where the sun is, and combines everything into one number.
              </p>
              <Link to="/explore" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-chalk hover:gap-3 transition-all">
                See today's scores <ArrowRight className="size-4" />
              </Link>
            </Reveal>
            <div className="space-y-4">
              {[
                { icon: Thermometer, title: 'Friction temps', body: 'Rock temperature (air temp plus the sun on the wall) scored against the 7–13°C sweet spot, with humidity and wind.', color: '#ff8a4c' },
                { icon: Sun, title: 'Sun & shade', body: 'Solar position is computed for every hour. Walls with a known aspect know whether they are baking or in the shade.', color: '#ffc65c' },
                { icon: CloudRain, title: 'Rock-type rules', body: 'Rain adds water, while sun, wind and dry air take it away. Wet sandstone is locked at "No-go" to protect fragile holds.', color: '#6cc4ff' },
                { icon: Layers, title: 'Best windows', body: 'Finds the stretches of daylight in the next 72 hours when conditions stay good.', color: '#c8f560' },
              ].map((s, i) => (
                <Reveal key={s.title} delay={i * 0.08}>
                  <div className="flex gap-4 rounded-2xl border border-white/5 bg-ink-950/40 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${s.color}18`, color: s.color }}>
                      <s.icon className="size-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-sm text-ink-300">{s.body}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* Leaderboard */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-chalk/80">Leaderboard</div>
            <h2 className="text-3xl font-bold sm:text-4xl">Where it's prime today</h2>
          </div>
          <Link to="/explore"><Button variant="secondary" icon={<Compass className="size-4" />}>Open the map</Button></Link>
        </Reveal>
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" variants={stagger.container} initial="hidden" whileInView="show" viewport={{ once: true }}>
          {(areas ?? Array.from({ length: 6 }, () => null)).slice(0, 6).map((a, i) =>
            a ? (
              <Card key={a.id} hover variants={stagger.item} whileHover={{ y: -3 }}>
                <Link to={`/areas/${a.id}`} className="flex items-center gap-4 p-5">
                  <span className="font-display text-2xl font-bold text-ink-600">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{a.name}</div>
                    <div className="truncate text-xs capitalize text-ink-400">{a.region} · {a.rock_type}</div>
                  </div>
                  <ScorePill score={a.conditions?.score} />
                </Link>
              </Card>
            ) : (
              <Skeleton key={i} className="h-20" />
            ),
          )}
        </motion.div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="mx-auto max-w-4xl px-4 pb-24 pt-8 text-center sm:px-6">
          <Reveal>
            <h2 className="text-4xl font-bold sm:text-5xl">Your next send starts with <span className="text-gradient">better timing.</span></h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register"><Button size="lg">Create free account</Button></Link>
              <Button size="lg" variant="secondary" onClick={startDemo} loading={demoLoading}>Try the demo</Button>
            </div>
          </Reveal>
        </section>
      )}
    </div>
  )
}
