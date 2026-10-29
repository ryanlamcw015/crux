import type { GradeSystem, Style } from '../types'

export interface ScoreTone {
  color: string
  label: string
  glow: string
}

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score === null || score === undefined) return { color: '#6b7a8c', label: 'No data', glow: 'rgb(107 122 140 / .3)' }
  if (score >= 80) return { color: '#a3e635', label: 'Prime', glow: 'rgb(163 230 53 / .35)' }
  if (score >= 65) return { color: '#34d399', label: 'Good', glow: 'rgb(52 211 153 / .3)' }
  if (score >= 45) return { color: '#fbbf24', label: 'Fair', glow: 'rgb(251 191 36 / .3)' }
  if (score >= 25) return { color: '#fb923c', label: 'Poor', glow: 'rgb(251 146 60 / .3)' }
  return { color: '#f87171', label: 'No-go', glow: 'rgb(248 113 113 / .3)' }
}

/** Same bucketing as backend/app/services/grades.py, for chart axes. */
export function gradeLabel(system: GradeSystem, index: number): string {
  if (system === 'v') {
    const n = Math.floor((index - 1000 + 3) / 10)
    return n <= 0 ? 'VB' : `V${n - 1}`
  }
  if (index < 100) return `5.${Math.max(0, Math.floor((index + 3) / 10))}`
  const n = Math.floor((index - 100) / 40)
  const rest = (index - 100) % 40
  return `5.${n + 10}${'abcd'[Math.min(3, Math.floor(rest / 10))]}`
}

export const STYLE_META: Record<Style, { label: string; color: string; short: string }> = {
  onsight: { label: 'Onsight', color: '#c8f560', short: 'OS' },
  flash: { label: 'Flash', color: '#6cc4ff', short: 'FL' },
  redpoint: { label: 'Redpoint', color: '#ff8a4c', short: 'RP' },
  send: { label: 'Send', color: '#ff8a4c', short: 'S' },
  repeat: { label: 'Repeat', color: '#93a1b2', short: 'RE' },
  attempt: { label: 'Attempt', color: '#6b7a8c', short: 'AT' },
}

export const DISCIPLINE_LABEL: Record<string, string> = {
  sport: 'Sport',
  trad: 'Trad',
  boulder: 'Boulder',
  tr: 'Top rope',
}

export const TIME_OF_DAY_LABEL: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  'all-day': 'All day',
}

export function compass(deg: number | null): string {
  if (deg === null) return 'Unknown'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export function todayISO(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** "2026-10-29" -> Date at local midnight (avoids the UTC off-by-one). */
function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return parseDay(iso).toLocaleDateString(undefined, opts)
}

export function relativeDay(iso: string): string {
  const diff = Math.round((parseDay(iso).getTime() - parseDay(todayISO()).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return parseDay(iso).toLocaleDateString(undefined, { weekday: 'long' })
  return formatDay(iso)
}

/** Local forecast times from the API ("2026-10-29T14:00") -> "2 PM". */
export function hourLabel(localIso: string): string {
  const h = Number(localIso.slice(11, 13))
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'just now'
  const steps: [number, string][] = [
    [60, 'm'],
    [3600, 'h'],
    [86400, 'd'],
    [604800, 'w'],
  ]
  let unit = 'm'
  let value = seconds / 60
  for (const [size, label] of steps) {
    if (seconds >= size) {
      unit = label
      value = seconds / size
    }
  }
  if (unit === 'w' && value > 8) return formatDay(iso, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${Math.floor(value)}${unit} ago`
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
