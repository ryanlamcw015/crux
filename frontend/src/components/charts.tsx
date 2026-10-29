import { motion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { STYLE_META, gradeLabel } from '../lib/format'
import type { GradeSystem, PyramidRow, Style, TrendRow } from '../types'

const AXIS = { fill: '#6b7a8c', fontSize: 11 }

function Box({ children }: { children: React.ReactNode }) {
  return <div className="glass min-w-36 border-white/10 bg-ink-900/95 p-3 text-xs">{children}</div>
}

/** Horizontal stacked bars, hardest grade on top: the classic pyramid. */
export function GradePyramid({ rows, boulder }: { rows: PyramidRow[]; boulder: boolean }) {
  if (rows.length === 0) return <div className="flex h-72 items-center justify-center text-sm text-ink-400">No sends logged yet</div>
  const keys = boulder ? (['flash', 'redpoint'] as const) : (['onsight', 'flash', 'redpoint'] as const)
  const label = (k: string) => (boulder && k === 'redpoint' ? 'Send' : STYLE_META[k as Style].label)
  return (
    <div style={{ height: Math.max(220, rows.length * 34 + 30) }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="grade" width={56} tickLine={false} axisLine={false} tick={{ ...AXIS, fontSize: 12, fill: '#c4cdd8' }} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Box>
                  <div className="mb-1 font-semibold">{(payload[0].payload as PyramidRow).grade}</div>
                  {keys.map((k) => (
                    <div key={k} className="flex justify-between gap-4 text-ink-300">
                      <span>{label(k)}</span>
                      <span className="text-ink-100">{(payload[0].payload as PyramidRow)[k]}</span>
                    </div>
                  ))}
                </Box>
              ) : null
            }
          />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={STYLE_META[k].color} radius={i === keys.length - 1 ? [0, 6, 6, 0] : 0} animationDuration={900} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-[11px] text-ink-400">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: STYLE_META[k].color }} />
            {label(k)}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Monthly sends (bars) and the hardest grade sent that month (line). */
export function SendTrend({ rows, system }: { rows: TrendRow[]; system: GradeSystem }) {
  const key = system === 'v' ? 'max_boulder_index' : 'max_route_index'
  const indexes = rows.map((r) => r[key]).filter((v): v is number => v !== null)
  const lo = indexes.length ? Math.min(...indexes) - 10 : 0
  const hi = indexes.length ? Math.max(...indexes) + 10 : 100
  const data = rows.map((r) => ({ ...r, label: new Date(`${r.month}-15`).toLocaleDateString(undefined, { month: 'short' }), grade: r[key] }))
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="sendsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6cc4ff" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#6cc4ff" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis yAxisId="sends" tickLine={false} axisLine={false} tick={AXIS} allowDecimals={false} />
          <YAxis
            yAxisId="grade"
            orientation="right"
            domain={[lo, hi]}
            tickLine={false}
            axisLine={false}
            tick={{ ...AXIS, fill: '#c8f560' }}
            width={52}
            tickFormatter={(v: number) => gradeLabel(system, v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload as TrendRow & { label: string }
              const top = system === 'v' ? r.max_boulder : r.max_route
              return (
                <Box>
                  <div className="mb-1 font-semibold">{new Date(`${r.month}-15`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
                  <div className="flex justify-between gap-4 text-ink-300"><span>Sends</span><span className="text-ink-100">{r.sends}</span></div>
                  <div className="flex justify-between gap-4 text-ink-300"><span>Days out</span><span className="text-ink-100">{r.days}</span></div>
                  <div className="flex justify-between gap-4 text-ink-300"><span>Hardest</span><span className="text-chalk">{top ?? '–'}</span></div>
                </Box>
              )
            }}
          />
          <Bar yAxisId="sends" dataKey="sends" fill="url(#sendsFill)" radius={[6, 6, 0, 0]} animationDuration={900} />
          <Line yAxisId="grade" type="monotone" dataKey="grade" stroke="#c8f560" strokeWidth={2.5} dot={{ r: 3, fill: '#c8f560' }} connectNulls animationDuration={1200} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Donut of ascent styles, drawn as SVG arcs that sweep in one after another. */
export function StyleDonut({ styles }: { styles: Partial<Record<Style, number>> }) {
  const data = (Object.entries(styles) as [Style, number][])
    .filter(([, n]) => n > 0)
    .map(([style, value]) => ({ style, value }))
    .sort((a, b) => b.value - a.value)
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = 64
  const circumference = 2 * Math.PI * radius
  const gap = 4
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
          {data.map((d, i) => {
            const length = Math.max(0, (d.value / total) * circumference - gap)
            const start = offset
            offset += (d.value / total) * circumference
            return (
              <motion.circle
                key={d.style}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={STYLE_META[d.style].color}
                strokeWidth="18"
                strokeDashoffset={-start}
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${length} ${circumference}` }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-ink-400">climbs</span>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {data.map((d) => (
          <div key={d.style} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: STYLE_META[d.style].color }} />
            <span className="w-20 text-ink-300">{STYLE_META[d.style].label}</span>
            <span className="font-semibold tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
