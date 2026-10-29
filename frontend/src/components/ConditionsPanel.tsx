import { CheckCircle2, CloudRain, Droplets, Info, Moon, Sun, Thermometer, Wind, XCircle } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useUnits } from '../hooks/useUnits'
import { formatDay, hourLabel, relativeDay, scoreTone } from '../lib/format'
import type { Forecast } from '../types'
import { ForecastChart } from './ForecastChart'
import { ScoreRing } from './ScoreRing'
import { Card, stagger } from './ui'

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-950/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-semibold">{value}</div>
    </div>
  )
}

const TONE_ICON = {
  good: <CheckCircle2 className="size-4 shrink-0 text-score-prime" />,
  bad: <XCircle className="size-4 shrink-0 text-score-nogo" />,
  info: <Info className="size-4 shrink-0 text-sky" />,
}

/** Score gauge, current weather, the reasons behind the score, best windows, daily outlook and hourly chart. */
export function ConditionsPanel({ forecast, aside }: { forecast: Forecast | null; aside?: ReactNode }) {
  const { temp, speed } = useUnits()

  if (!forecast) {
    return (
      <Card className="p-8 text-center text-sm text-ink-300">
        The weather service is unavailable right now, so conditions can't be scored. Try again in a few minutes.
      </Card>
    )
  }
  const now = forecast.now

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-4 p-8">
          <ScoreRing score={forecast.score} size={196} />
          <div className="text-center text-xs text-ink-400">
            Conditions now · {forecast.rock.label}
          </div>
          {aside}
        </Card>

        <Card className="p-6">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Stat icon={<Thermometer className="size-3.5" />} label="Air" value={temp(now.temp_c)} />
            <Stat icon={<Thermometer className="size-3.5" />} label="Rock" value={temp(now.rock_temp_c)} />
            <Stat icon={<Droplets className="size-3.5" />} label="Humidity" value={`${now.humidity}%`} />
            <Stat icon={<Wind className="size-3.5" />} label="Wind" value={speed(now.wind_kmh)} />
            <Stat icon={<CloudRain className="size-3.5" />} label="Rain" value={`${now.precip_prob}%`} />
            <Stat
              icon={now.is_day ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              label="Wall"
              value={!now.is_day ? 'Night' : now.in_sun === null ? 'Mixed' : now.in_sun ? 'Sunny' : 'Shady'}
            />
          </div>
          <motion.ul className="grid gap-2 sm:grid-cols-2" variants={stagger.container} initial="hidden" animate="show">
            {forecast.reasons.map((r) => (
              <motion.li key={r.text} variants={stagger.item} className="flex items-start gap-2 text-sm text-ink-200">
                {TONE_ICON[r.tone]}
                {r.text}
              </motion.li>
            ))}
          </motion.ul>
          <p className="mt-4 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-ink-300">
            <span className="font-semibold text-ink-100">{forecast.rock.label}:</span> {forecast.rock.note}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Next 72 hours</h3>
            <span className="text-xs text-ink-400">Local time at the crag</span>
          </div>
          <ForecastChart hours={forecast.hourly} />
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="mb-3 text-lg font-semibold">Best windows</h3>
            {forecast.best_windows.length === 0 ? (
              <p className="text-sm text-ink-400">No good daylight windows in the next few days. Check another crag.</p>
            ) : (
              <div className="space-y-2">
                {forecast.best_windows.map((w) => {
                  const tone = scoreTone(w.avg_score)
                  return (
                    <div key={w.start} className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-950/40 px-3 py-2.5">
                      <div>
                        <div className="text-sm font-semibold">{relativeDay(w.start)}</div>
                        <div className="text-xs text-ink-400">
                          {hourLabel(w.start)} – {hourLabel(w.end)}
                        </div>
                      </div>
                      <span className="font-display text-xl font-bold" style={{ color: tone.color }}>
                        {w.avg_score}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
          <Card className="p-6">
            <h3 className="mb-3 text-lg font-semibold">Daily outlook</h3>
            <div className="grid grid-cols-2 gap-2">
              {forecast.days.map((d) => {
                const tone = scoreTone(d.best_score)
                return (
                  <div key={d.date} className="rounded-xl border border-white/5 bg-ink-950/40 p-3">
                    <div className="text-xs font-semibold text-ink-300">{formatDay(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="mt-1 font-display text-2xl font-bold" style={{ color: tone.color }}>
                      {d.best_score}
                    </div>
                    <div className="text-[11px] text-ink-400">
                      {temp(d.low_c)} / {temp(d.high_c)}
                      {d.rain_mm > 0 && ` · ${d.rain_mm}mm`}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
