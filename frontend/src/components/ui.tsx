import { AlertTriangle, Loader2, X } from 'lucide-react'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cx, scoreTone } from '../lib/format'
import type { User } from '../types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-chalk text-ink-950 hover:bg-[#d6ff7a] shadow-[0_0_0_1px_rgba(200,245,96,.4),0_8px_30px_-8px_rgba(200,245,96,.6)]',
  secondary: 'bg-white/[0.06] text-ink-100 border border-white/10 hover:bg-white/10 hover:border-white/20',
  ghost: 'text-ink-200 hover:bg-white/[0.06] hover:text-white',
  danger: 'bg-score-nogo/10 text-score-nogo border border-score-nogo/30 hover:bg-score-nogo/20',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' }
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-semibold transition duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function Card({ className, children, hover, ...rest }: HTMLMotionProps<'div'> & { hover?: boolean }) {
  return (
    <motion.div className={cx('glass', hover && 'glass-hover', className)} {...rest}>
      {children}
    </motion.div>
  )
}

/** Fade-and-rise when scrolled into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
  },
}

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition',
        active
          ? 'border-chalk/50 bg-chalk/15 text-chalk'
          : 'border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/20 hover:text-ink-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', className)}
      style={color ? { color, background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}33` } : undefined}
    >
      {children}
    </span>
  )
}

export function ScorePill({ score, className }: { score: number | null | undefined; className?: string }) {
  const tone = scoreTone(score)
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', className)}
      style={{ color: tone.color, background: `${tone.color}1a`, boxShadow: `inset 0 0 0 1px ${tone.color}40` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: tone.color, boxShadow: `0 0 8px ${tone.color}` }} />
      {score ?? '–'}
      <span className="font-medium opacity-80">{tone.label}</span>
    </span>
  )
}

export function Avatar({ user, size = 40, link = true }: { user: Pick<User, 'display_name' | 'avatar_hue' | 'username'>; size?: number; link?: boolean }) {
  const initials = user.display_name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const el = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-ink-950 ring-2 ring-ink-950"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${user.avatar_hue} 85% 72%), hsl(${(user.avatar_hue + 40) % 360} 80% 58%))`,
      }}
    >
      {initials}
    </span>
  )
  return link ? (
    <Link to={`/u/${user.username}`} className="shrink-0 transition hover:scale-105">
      {el}
    </Link>
  ) : (
    el
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-ink-300 ring-1 ring-white/10">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-300">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="size-6 text-score-poor" />
      <p className="text-sm text-ink-200">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  )
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-chalk/80">{eyebrow}</div>}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold sm:text-4xl"
        >
          {title}
        </motion.h1>
        {subtitle && <p className="mt-2 max-w-2xl text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cx(
              'glass relative max-h-[92vh] w-full overflow-y-auto rounded-b-none border-white/10 bg-ink-900/95 p-6 sm:rounded-2xl',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            )}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="relative inline-flex rounded-xl border border-white/10 bg-ink-950/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'relative z-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === o.value ? 'text-ink-950' : 'text-ink-300 hover:text-white',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join('-')}`}
              className="absolute inset-0 -z-10 rounded-lg bg-chalk"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Small confirmation that floats up from the bottom of the screen. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[1200] flex justify-center px-4 lg:bottom-8">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="rounded-full bg-chalk px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_10px_40px_-10px_rgba(200,245,96,.7)]"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback((text: string) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), 2800)
  }, [])
  return { message, show }
}

export function StatTile({ label, value, sub, icon, accent = '#c8f560' }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; accent?: string }) {
  return (
    <Card className="relative overflow-hidden p-5" variants={stagger.item}>
      <div className="absolute -right-6 -top-6 size-24 rounded-full blur-2xl" style={{ background: `${accent}22` }} />
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-300">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-ink-400">{sub}</div>}
    </Card>
  )
}
