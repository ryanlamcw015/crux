import {
  ArrowRight,
  BarChart3,
  ChevronsDown,
  BookOpen,
  CloudRain,
  Compass,
  Gauge,
  Handshake,
  Layers,
  Rss,
  Search,
  Sparkles,
  Sun,
  Thermometer,
} from 'lucide-react'
import { animate, motion, useInView, useScroll, useTransform, type MotionValue } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/endpoints'
import { ScoreRing } from '../components/ScoreRing'
import { Button, Card, Reveal, ScorePill, Skeleton, stagger } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useUnits } from '../hooks/useUnits'
import { dotJoin, rockText } from '../lib/format'

// three.js is big, so the 3D scene loads as its own chunk after the page is interactive.
const ElCapScene = lazy(() => import('../components/ElCapScene'))

/** Fade a caption in and out across a slice of the scroll track. The first starts visible; the last stays. */
function useCaption(progress: MotionValue<number>, from: number, to: number, edge?: 'first' | 'last') {
  const fade = 0.06
  const stops = edge === 'first' ? [0, to - fade, to] : edge === 'last' ? [0, from, from + fade] : [from, from + fade, to - fade, to]
  const opacity = useTransform(progress, stops, edge === 'first' ? [1, 1, 0] : edge === 'last' ? [0, 0, 1] : [0, 1, 1, 0])
  const y = useTransform(progress, stops, edge === 'first' ? [0, 0, -40] : edge === 'last' ? [40, 40, 0] : [40, 0, 0, -40])
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? 'auto' : 'none'))
  return [opacity, y, pointerEvents] as const
}

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
  { icon: Gauge, title: 'Conditions Score', body: 'A 0–100 rating for every crag, hour by hour, from live weather, sun and shade, and how each rock type dries.', color: '#ffc56e' },
  { icon: Compass, title: 'Route finder & map', body: 'Every US and Canadian climb on OpenBeta. Filter by grade and style, and see which walls are in condition right now.', color: '#6cc4ff' },
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
  const [search, setSearch] = useState('')
  const { data: areas } = useApi(() => api.areas({ sort: 'score' }), [])
  const { data: stats } = useApi(() => api.stats(), [])
  const best = areas?.[0]

  const trackRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] })
  const [introOpacity, introY, introEvents] = useCaption(scrollYProgress, 0, 0.2, 'first')
  const [scoreOpacity, scoreY, scoreEvents] = useCaption(scrollYProgress, 0.26, 0.54)
  const [dataOpacity, dataY, dataEvents] = useCaption(scrollYProgress, 0.6, 1, 'last')

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
    <div className="overflow-x-clip">
      {/* Hero: a tall scroll track with a pinned 3D stage. Scrolling turns El Capitan and swaps the captions. */}
      <section ref={trackRef} className="relative -mt-16 h-[360vh]">
        <div className="sticky top-0 h-svh overflow-hidden">
          <div className="hero-sky absolute inset-0" />
          <Suspense fallback={null}>
            <ElCapScene progress={scrollYProgress} className="absolute inset-0" />
          </Suspense>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />

          {/* Caption 1: headline, with a soft scrim so it stays readable over the wall */}
          <motion.div style={{ opacity: introOpacity }} className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-b from-ink-950/70 via-ink-950/20 to-transparent sm:w-[62%] sm:bg-gradient-to-r sm:from-ink-950/85 sm:via-ink-950/45" />
          <motion.div style={{ opacity: introOpacity, y: introY, pointerEvents: introEvents }} className="absolute inset-0 flex items-start pt-28 sm:items-center sm:pt-16">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
              <div className="max-w-xl">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="eyebrow-pill mb-5"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-chalk opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-chalk" />
                  </span>
                  Live conditions · {(stats?.areas ?? 8000).toLocaleString()} climbing areas
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="text-5xl font-bold leading-[0.98] drop-shadow-[0_2px_24px_rgba(7,11,16,.55)] sm:text-6xl lg:text-7xl"
                >
                  Know exactly
                  <br />
                  <span className="text-gradient">when to send.</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.6 }}
                  className="mt-5 max-w-md text-base text-ink-100/90 drop-shadow-[0_1px_12px_rgba(7,11,16,.7)] sm:text-lg"
                >
                  Weather, sun angle and rock type, boiled down to one Conditions Score for every wall from El Cap to your
                  local boulders.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.6 }}
                  className="mt-8 flex flex-wrap items-center gap-3"
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
                {!user && <p className="mt-3 text-xs text-ink-200/80">No signup needed: the demo account comes with a year of logged climbs.</p>}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-200/80">
              Scroll to turn the wall
              <ChevronsDown className="size-4 animate-bounce" />
            </div>
          </motion.div>

          {/* Caption 2: the score, with what's best right now */}
          <motion.div style={{ opacity: scoreOpacity, y: scoreY, pointerEvents: scoreEvents }} className="absolute inset-0 flex items-end pb-24 sm:items-center sm:pb-0">
            <div className="mx-auto flex w-full max-w-7xl justify-end px-4 sm:px-6">
              <div className="glass-panel w-full max-w-md p-6 sm:p-7">
                <div className="eyebrow mb-2">Sun, shade and stone</div>
                <h2 className="text-3xl font-bold">Every wall, hour by hour</h2>
                <p className="mt-3 text-sm text-ink-200">
                  Crux tracks where the sun sits on each wall, how long the rock takes to dry, and when the friction is best.
                </p>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                    Best right now
                    <span className="flex items-center gap-1.5 normal-case tracking-normal text-ink-300">
                      <span className="size-1.5 rounded-full bg-score-prime" /> live
                    </span>
                  </div>
                  {best ? (
                    <Link to={`/areas/${best.id}`} className="group flex items-center gap-5">
                      <ScoreRing score={best.conditions?.score ?? null} size={104} />
                      <div className="min-w-0">
                        <div className="truncate font-display text-xl font-bold group-hover:text-chalk">{best.name}</div>
                        <div className="text-sm text-ink-300">{best.region}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-ink-200">
                          {best.conditions && <span className="rounded-md bg-white/10 px-2 py-1">{temp(best.conditions.temp_c)}</span>}
                          <span className="rounded-md bg-white/10 px-2 py-1">{best.route_count.toLocaleString()} routes</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <Skeleton className="h-[104px]" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Caption 3: the database, with a working search */}
          <motion.div style={{ opacity: dataOpacity, y: dataY, pointerEvents: dataEvents }} className="absolute inset-0 flex items-end pb-24 sm:items-center sm:pb-0">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
              <div className="glass-panel w-full max-w-md p-6 sm:p-7">
                <div className="eyebrow mb-2">United States + Canada</div>
                <h2 className="text-3xl font-bold">
                  <CountUp to={stats?.routes ?? 200000} /> climbs.
                  <br />
                  Boulders to big walls.
                </h2>
                <p className="mt-3 text-sm text-ink-200">
                  Sport, trad and bouldering across {(stats?.crags ?? 30000).toLocaleString()} walls and boulders, from Hueco Tanks to Squamish.
                </p>
                <form
                  className="mt-5 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    navigate(`/explore${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`)
                  }}
                >
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-300" />
                    <input className="input pl-9" placeholder="Try “Hueco Tanks”" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search climbing areas" />
                  </div>
                  <Button type="submit" icon={<ArrowRight className="size-4" />}>Find</Button>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 eyebrow">Everything in one place</div>
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,197,110,0.08),transparent_50%)]" />
          <div className="relative grid gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="mb-3 eyebrow">The model</div>
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
                { icon: Layers, title: 'Best windows', body: 'Finds the stretches of daylight in the next 72 hours when conditions stay good.', color: '#ffc56e' },
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
            <div className="mb-2 eyebrow">Leaderboard</div>
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
                    <div className="truncate text-xs capitalize text-ink-400">{dotJoin(a.region, rockText(a.rock_type))}</div>
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
