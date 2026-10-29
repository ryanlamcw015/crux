import { BookOpen, Building2, MapPin, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { api } from '../api/endpoints'
import { LogAscentModal } from '../components/LogAscentModal'
import { Badge, Button, Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton, Toast, useToast } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { DISCIPLINE_LABEL, STYLE_META, formatDay, relativeDay } from '../lib/format'
import type { Ascent } from '../types'

type Filter = 'all' | 'outdoor' | 'gym' | 'sends'

export function LogbookPage() {
  const { data: ascents, error, loading, reload, setData } = useApi(() => api.ascents(), [])
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing: Ascent | null }>({ open: false, editing: null })
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const toast = useToast()

  const sessions = useMemo(() => {
    const needle = q.toLowerCase()
    const visible = (ascents ?? []).filter(
      (a) =>
        (filter === 'all' ||
          (filter === 'gym' && a.is_gym) ||
          (filter === 'outdoor' && !a.is_gym) ||
          (filter === 'sends' && a.style !== 'attempt')) &&
        (!needle || `${a.name} ${a.venue} ${a.grade}`.toLowerCase().includes(needle)),
    )
    const byDay = new Map<string, Ascent[]>()
    for (const a of visible) byDay.set(a.climbed_on, [...(byDay.get(a.climbed_on) ?? []), a])
    return [...byDay.entries()]
  }, [ascents, filter, q])

  const onSaved = (saved: Ascent) => {
    setData((prev) => {
      const rest = (prev ?? []).filter((a) => a.id !== saved.id)
      return [saved, ...rest].sort((a, b) => b.climbed_on.localeCompare(a.climbed_on) || b.id - a.id)
    })
    toast.show(modal.editing ? 'Saved ✓' : `Logged ${saved.name} (${saved.grade}) ✓`)
  }

  const remove = async (id: number) => {
    await api.deleteAscent(id)
    setData((prev) => (prev ?? []).filter((a) => a.id !== id))
    setConfirmDelete(null)
    toast.show('Deleted')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Logbook"
        title="Every send, every session"
        subtitle={ascents ? `${ascents.length} climbs across ${new Set(ascents.map((a) => a.climbed_on)).size} days` : undefined}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true, editing: null })}>Log a climb</Button>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'sends', 'outdoor', 'gym'] as Filter[]).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'sends' ? 'Sends only' : f === 'gym' ? 'Gym' : 'Outdoor'}
            </Chip>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-ink-400" />
          <input className="input h-9 py-1.5 pl-9" placeholder="Search your climbs" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !ascents && <div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>}
      {ascents && ascents.length === 0 && (
        <Card>
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="Your logbook is empty"
            body="Log a gym session or search 17,000 outdoor routes. Your progress charts build themselves from here."
            action={<Button onClick={() => setModal({ open: true, editing: null })}>Log your first climb</Button>}
          />
        </Card>
      )}

      <div className="space-y-5">
        {sessions.slice(0, 60).map(([day, items], si) => (
          <motion.div key={day} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(si * 0.04, 0.4) }}>
            <Card className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-3">
                <div>
                  <span className="font-semibold">{relativeDay(day)}</span>
                  <span className="ml-2 text-xs text-ink-400">{formatDay(day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-ink-400">
                  {items[0].is_gym ? <Building2 className="size-3.5" /> : <MapPin className="size-3.5" />}
                  <span className="max-w-48 truncate">{items[0].is_gym ? items[0].venue : items[0].venue.split(', ').pop()}</span>
                </span>
              </div>
              <AnimatePresence initial={false}>
                {items.map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex items-start gap-4 border-b border-white/5 px-5 py-3.5 last:border-0"
                  >
                    <span className="mt-0.5 w-14 shrink-0 font-display text-lg font-bold text-chalk">{a.grade}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{a.name}</span>
                        <Badge color={STYLE_META[a.style].color}>{STYLE_META[a.style].label}</Badge>
                        {a.rating && (
                          <span className="flex">
                            {Array.from({ length: a.rating }, (_, i) => <Star key={i} className="size-3 fill-ember text-ember" />)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-400">
                        {DISCIPLINE_LABEL[a.discipline]} · {a.venue || 'Unknown venue'}
                        {a.attempts > 1 && ` · ${a.attempts} tries`}
                      </div>
                      {a.notes && <p className="mt-1.5 text-sm text-ink-300">{a.notes}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
                      {confirmDelete === a.id ? (
                        <>
                          <Button size="sm" variant="danger" onClick={() => remove(a.id)}>Delete</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Keep</Button>
                        </>
                      ) : (
                        <>
                          <button className="rounded-lg p-2 text-ink-300 hover:bg-white/10 hover:text-white" onClick={() => setModal({ open: true, editing: a })} aria-label="Edit">
                            <Pencil className="size-4" />
                          </button>
                          <button className="rounded-lg p-2 text-ink-300 hover:bg-score-nogo/10 hover:text-score-nogo" onClick={() => setConfirmDelete(a.id)} aria-label="Delete">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Card>
          </motion.div>
        ))}
      </div>
      {sessions.length > 60 && <p className="mt-6 text-center text-xs text-ink-400">Showing your 60 most recent sessions. Search to find older climbs.</p>}

      <LogAscentModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} onSaved={onSaved} />
      <Toast message={toast.message} />
    </div>
  )
}
