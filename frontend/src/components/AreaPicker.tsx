import { Check, MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/endpoints'
import { cx } from '../lib/format'
import type { AreaSummary } from '../types'

/**
 * Type-ahead search for a climbing area. There are thousands of areas, far too many for a dropdown,
 * so this asks the API for matches as you type (a "combobox").
 */
export function AreaPicker({
  value,
  onChange,
  placeholder = 'Search areas…',
  required,
  className,
}: {
  value: number | null
  onChange: (id: number | null, area: AreaSummary | null) => void
  placeholder?: string
  required?: boolean
  className?: string
}) {
  const [selected, setSelected] = useState<AreaSummary | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AreaSummary[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // The parent only knows the id, so look up the name to show.
  useEffect(() => {
    if (value === null) return setSelected(null)
    if (selected?.id === value) return
    let cancelled = false
    api.areas({ id: value }).then((found) => {
      if (!cancelled) setSelected(found[0] ?? null)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [value, selected?.id])

  // Debounced search: wait until typing pauses before calling the API.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      api.areas({ q: query.trim() || undefined, limit: 8 })
        .then((found) => { if (!cancelled) setResults(found) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, open])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const pick = (area: AreaSummary | null) => {
    setSelected(area)
    setQuery('')
    setOpen(false)
    onChange(area?.id ?? null, area)
  }

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-400" />
      <input
        className="input px-9"
        placeholder={placeholder}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={open ? query : selected ? `${selected.name}, ${selected.region}` : ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setResults([]); setOpen(true) }} // drop stale matches so Enter can't pick one
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter' && open && results[0]) { e.preventDefault(); pick(results[0]) }
        }}
      />
      {selected && !open && (
        <button type="button" onClick={() => pick(null)} className="absolute right-2 top-2 rounded-lg p-1.5 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="Clear area">
          <X className="size-4" />
        </button>
      )}
      {open && (
        <div className="glass-panel absolute inset-x-0 top-12 z-[1200] max-h-72 overflow-y-auto !rounded-2xl p-1.5" role="listbox">
          {results.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={a.id === selected?.id}
              onClick={() => pick(a)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
            >
              <MapPin className="size-4 shrink-0 text-chalk" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block truncate text-xs text-ink-300">{a.region} · {a.route_count.toLocaleString()} routes</span>
              </span>
              {a.id === selected?.id && <Check className="size-4 text-chalk" />}
            </button>
          ))}
          {!loading && results.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-300">No areas match “{query}”.</div>}
          {loading && results.length === 0 && <div className="px-3 py-4 text-center text-sm text-ink-300">Searching…</div>}
        </div>
      )}
    </div>
  )
}
