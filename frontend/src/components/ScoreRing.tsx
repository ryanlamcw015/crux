import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useId } from 'react'
import { scoreTone } from '../lib/format'

/** Circular 0-100 gauge that sweeps and counts up to the score. */
export function ScoreRing({ score, size = 168, stroke = 12, caption }: { score: number | null; size?: number; stroke?: number; caption?: string }) {
  const tone = scoreTone(score)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = useMotionValue(0)
  const dashOffset = useTransform(progress, (v) => circumference * (1 - v / 100))
  const display = useTransform(progress, (v) => Math.round(v))
  const gradientId = useId()

  useEffect(() => {
    const controls = animate(progress, score ?? 0, { duration: 1.4, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [score, progress])

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-3 rounded-full blur-2xl" style={{ background: tone.glow }} />
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone.color} />
            <stop offset="100%" stopColor={tone.color} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset, filter: `drop-shadow(0 0 6px ${tone.glow})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span className="font-display font-bold tabular-nums" style={{ fontSize: size * 0.3, color: tone.color }}>
          {score === null ? '–' : display}
        </motion.span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">{caption ?? tone.label}</span>
      </div>
    </div>
  )
}
