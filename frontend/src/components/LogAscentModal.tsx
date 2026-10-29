import { Building2, Mountain, Search, Star } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/endpoints'
import { useMeta } from '../hooks/useMeta'
import { DISCIPLINE_LABEL, STYLE_META, cx, todayISO } from '../lib/format'
import type { Ascent, AscentInput, Discipline, Route, Style } from '../types'
import { Button, Chip, Modal, Segmented } from './ui'

const ROUTE_STYLES: Style[] = ['onsight', 'flash', 'redpoint', 'repeat', 'attempt']
const BOULDER_STYLES: Style[] = ['flash', 'send', 'repeat', 'attempt']

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (ascent: Ascent) => void
  initialRoute?: Route | null
  editing?: Ascent | null
}

/** Log a new climb or edit an existing one: an outdoor route from the database, or a gym/custom climb. */
export function LogAscentModal({ open, onClose, onSaved, initialRoute, editing }: Props) {
  const meta = useMeta()
  const [mode, setMode] = useState<'route' | 'custom'>('route')
  const [route, setRoute] = useState<Route | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Route[]>([])
  const [searching, setSearching] = useState(false)

  const [name, setName] = useState('')
  const [discipline, setDiscipline] = useState<Discipline>('boulder')
  const [grade, setGrade] = useState('V3')
  const [venue, setVenue] = useState('')
  const [isGym, setIsGym] = useState(true)

  const [date, setDate] = useState(todayISO())
  const [style, setStyle] = useState<Style>('flash')
  const [attempts, setAttempts] = useState(1)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form every time it opens
  useEffect(() => {
    if (!open) return
    setError(null)
    setQuery('')
    setResults([])
    if (editing) {
      setMode(editing.route_id ? 'route' : 'custom')
      setRoute(null)
      setName(editing.name)
      setDiscipline(editing.discipline)
      setGrade(editing.grade)
      setVenue(editing.venue)
      setIsGym(editing.is_gym)
      setDate(editing.climbed_on)
      setStyle(editing.style)
      setAttempts(editing.attempts)
      setRating(editing.rating)
      setNotes(editing.notes)
      if (editing.route_id) api.route(editing.route_id).then(setRoute).catch(() => setRoute(null))
      return
    }
    setMode('route')
    setRoute(initialRoute ?? null)
    setName('')
    setVenue('')
    setIsGym(true)
    setDate(todayISO())
    setStyle(initialRoute?.discipline === 'boulder' ? 'flash' : 'redpoint')
    setAttempts(1)
    setRating(null)
    setNotes('')
  }, [open, editing, initialRoute])

  // Debounced route search
  useEffect(() => {
    if (mode !== 'route' || query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const handle = setTimeout(() => {
      api
        .routes({ q: query.trim(), limit: 12 })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [query, mode])

  const isBoulder = mode === 'route' ? route?.discipline === 'boulder' : discipline === 'boulder'
  const styles = isBoulder ? BOULDER_STYLES : ROUTE_STYLES
  const gradeList = meta ? meta.grades[discipline === 'boulder' ? 'v' : 'yds'] : []

  useEffect(() => {
    if (!styles.includes(style)) setStyle(isBoulder ? 'send' : 'redpoint')
  }, [isBoulder, style, styles])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const base = { climbed_on: date, style, attempts, rating, notes }
    let body: AscentInput
    if (mode === 'route') {
      if (!route) {
        setError('Search for a route and select it')
        return
      }
      body = { ...base, route_id: route.id }
    } else {
      if (!name.trim()) {
        setError('Give the climb a name, e.g. "Blue circuit #4"')
        return
      }
      body = { ...base, route_id: null, name: name.trim(), grade, discipline, venue: venue.trim(), is_gym: isGym }
    }
    setSaving(true)
    try {
      onSaved(editing ? await api.updateAscent(editing.id, body) : await api.createAscent(body))
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit climb' : 'Log a climb'} wide>
      <form onSubmit={submit} className="space-y-5">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'route', label: <span className="flex items-center gap-1.5"><Mountain className="size-3.5" /> Outdoor route</span> },
            { value: 'custom', label: <span className="flex items-center gap-1.5"><Building2 className="size-3.5" /> Gym / custom</span> },
          ]}
        />

        {mode === 'route' ? (
          <div>
            <label className="label">Route</label>
            {route ? (
              <div className="flex items-center justify-between rounded-xl border border-chalk/30 bg-chalk/[0.06] px-4 py-3">
                <div>
                  <div className="font-semibold">
                    {route.name} <span className="text-chalk">{route.grade}</span>
                  </div>
                  <div className="text-xs text-ink-300">
                    {route.crag_name} · {route.area_name} · {DISCIPLINE_LABEL[route.discipline]}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRoute(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-400" />
                <input
                  autoFocus
                  className="input pl-9"
                  placeholder="Search 17,000 routes, e.g. Monkey Face"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {(results.length > 0 || searching) && (
                  <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-ink-950/80">
                    {searching && results.length === 0 && <div className="p-3 text-sm text-ink-400">Searching…</div>}
                    {results.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setRoute(r)}
                        className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5 text-left last:border-0 hover:bg-white/[0.05]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.name}</span>
                          <span className="block truncate text-xs text-ink-400">
                            {r.crag_name} · {r.area_name}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-chalk">{r.grade}</span>
                      </button>
                    ))}
                  </div>
                )}
                {query.length >= 2 && !searching && results.length === 0 && (
                  <p className="mt-2 text-xs text-ink-400">
                    No matches. Switch to <button type="button" className="text-chalk underline" onClick={() => setMode('custom')}>Gym / custom</button> to log it anyway.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name</label>
              <input className="input" placeholder="Blue circuit #4" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={discipline}
                onChange={(e) => {
                  const d = e.target.value as Discipline
                  setDiscipline(d)
                  setGrade(d === 'boulder' ? 'V3' : '5.10a')
                }}
              >
                {(['boulder', 'sport', 'tr', 'trad'] as Discipline[]).map((d) => (
                  <option key={d} value={d}>
                    {DISCIPLINE_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Grade</label>
              <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {gradeList.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Where</label>
              <input className="input" placeholder="Gym or crag name" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
            <div>
              <label className="label">Setting</label>
              <Segmented
                value={isGym ? 'gym' : 'outdoor'}
                onChange={(v) => setIsGym(v === 'gym')}
                options={[
                  { value: 'gym', label: 'Gym' },
                  { value: 'outdoor', label: 'Outdoor' },
                ]}
              />
            </div>
          </div>
        )}

        <div>
          <label className="label">How did it go?</label>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <Chip key={s} active={style === s} onClick={() => setStyle(s)}>
                <span className="size-2 rounded-full" style={{ background: STYLE_META[s].color }} />
                {STYLE_META[s].label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">Attempts</label>
            <input type="number" className="input" min={1} max={500} value={attempts} onChange={(e) => setAttempts(Math.max(1, Number(e.target.value)))} />
          </div>
          <div>
            <label className="label">Quality</label>
            <div className="flex h-[42px] items-center gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button type="button" key={n} onClick={() => setRating(rating === n ? null : n)} aria-label={`${n} stars`}>
                  <Star className={cx('size-6 transition', rating !== null && n <= rating ? 'fill-ember text-ember' : 'text-ink-600 hover:text-ink-400')} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-20 resize-y" placeholder="Beta, conditions, how it felt…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>

        {error && <p className="rounded-lg bg-score-nogo/10 px-3 py-2 text-sm text-score-nogo">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? 'Save changes' : 'Log it'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
