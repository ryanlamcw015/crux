import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useUnits } from '../hooks/useUnits'
import { formatDay, hourLabel, scoreTone } from '../lib/format'
import type { HourScore } from '../types'

interface Point extends HourScore {
  label: string
  temp: number
  nightScore: number | null
  dayScore: number | null
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const { temp, speed } = useUnits()
  if (!active || !payload?.length) return null
  const h = payload[0].payload
  const tone = scoreTone(h.score)
  return (
    <div className="glass min-w-44 border-white/10 bg-ink-900/95 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="font-semibold text-ink-100">
          {formatDay(h.time, { weekday: 'short' })} · {hourLabel(h.time)}
        </span>
        <span className="font-bold" style={{ color: tone.color }}>
          {h.score}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ink-300">
        <span>Air</span>
        <span className="text-right text-ink-100">{temp(h.temp_c)}</span>
        <span>On the rock</span>
        <span className="text-right text-ink-100">{temp(h.rock_temp_c)}</span>
        <span>Humidity</span>
        <span className="text-right text-ink-100">{h.humidity}%</span>
        <span>Rain chance</span>
        <span className="text-right text-ink-100">{h.precip_prob}%</span>
        <span>Wind</span>
        <span className="text-right text-ink-100">{speed(h.wind_kmh)}</span>
        {h.in_sun !== null && (
          <>
            <span>Wall</span>
            <span className="text-right text-ink-100">{h.in_sun ? 'In sun' : 'Shade'}</span>
          </>
        )}
      </div>
      {h.wet && <div className="mt-2 text-score-poor">Rock still wet</div>}
    </div>
  )
}

/** 72-hour outlook: score (filled area), rock temperature (line) and rain chance (bars). */
export function ForecastChart({ hours }: { hours: HourScore[] }) {
  const { units } = useUnits()
  const data: Point[] = hours.map((h) => ({
    ...h,
    label: h.time,
    temp: units === 'metric' ? h.rock_temp_c : (h.rock_temp_c * 9) / 5 + 32,
    dayScore: h.is_day ? h.score : null,
    nightScore: h.score,
  }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8f560" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#c8f560" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={11}
            tick={{ fill: '#6b7a8c', fontSize: 11 }}
            tickFormatter={(v: string) => (v.slice(11, 13) === '00' ? formatDay(v, { weekday: 'short' }) : hourLabel(v))}
          />
          <YAxis yAxisId="score" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#6b7a8c', fontSize: 11 }} />
          <YAxis yAxisId="temp" orientation="right" hide />
          <YAxis yAxisId="rain" domain={[0, 100]} hide />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
          <Bar yAxisId="rain" dataKey="precip_prob" fill="#6cc4ff" fillOpacity={0.25} radius={[2, 2, 0, 0]} />
          <Area
            yAxisId="score"
            type="monotone"
            dataKey="nightScore"
            stroke="rgba(200,245,96,0.25)"
            strokeDasharray="3 4"
            fill="none"
            isAnimationActive={false}
          />
          <Area yAxisId="score" type="monotone" dataKey="dayScore" stroke="#c8f560" strokeWidth={2} fill="url(#scoreFill)" connectNulls={false} />
          <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="#ff8a4c" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-chalk" /> Score (daylight)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-ember" /> Rock temp</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky/40" /> Rain chance</span>
      </div>
    </div>
  )
}
