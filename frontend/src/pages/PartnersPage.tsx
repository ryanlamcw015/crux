import { Building2, CalendarDays, Clock, Handshake, LocateFixed, MapPin, MessageCircle, Mountain, Plus, Send, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/endpoints'
import { Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, Modal, PageHeader, Segmented, Skeleton, Toast, useToast } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { useGeolocation } from '../hooks/useGeolocation'
import { useUnits } from '../hooks/useUnits'
import { DISCIPLINE_LABEL, TIME_OF_DAY_LABEL, addDaysISO, formatDay, relativeDay, timeAgo, todayISO } from '../lib/format'
import type { Discipline, PartnerPost, PartnerPostInput } from '../types'

const DISCIPLINES: Discipline[] = ['sport', 'trad', 'boulder', 'tr']

function NewPostModal({ open, onClose, onCreated, defaultAreaId }: { open: boolean; onClose: () => void; onCreated: (p: PartnerPost) => void; defaultAreaId?: number }) {
  const { data: areas } = useApi(() => api.areas({ sort: 'name' }), [])
  const geo = useGeolocation()
  const [form, setForm] = useState<PartnerPostInput>({
    setting: defaultAreaId ? 'outdoor' : 'gym',
    area_id: defaultAreaId ?? null,
    location_name: '',
    lat: null,
    lon: null,
    climb_on: addDaysISO(1),
    time_of_day: 'evening',
    disciplines: ['boulder'],
    grade_range: '',
    message: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PartnerPostInput>(k: K, v: PartnerPostInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.disciplines.length === 0) return setError('Pick at least one style')
    setSaving(true)
    try {
      const body = form.setting === 'gym' ? { ...form, area_id: null, lat: geo.coords?.lat ?? null, lon: geo.coords?.lon ?? null } : form
      onCreated(await api.createPartnerPost(body))
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Find a climbing partner">
      <form onSubmit={submit} className="space-y-4">
        <Segmented
          value={form.setting}
          onChange={(v) => set('setting', v)}
          options={[
            { value: 'gym', label: <span className="flex items-center gap-1.5"><Building2 className="size-3.5" /> Gym</span> },
            { value: 'outdoor', label: <span className="flex items-center gap-1.5"><Mountain className="size-3.5" /> Outdoor</span> },
          ]}
        />
        {form.setting === 'outdoor' ? (
          <div>
            <label className="label">Area</label>
            <select className="input" value={form.area_id ?? ''} onChange={(e) => set('area_id', e.target.value ? Number(e.target.value) : null)} required>
              <option value="">Choose an area</option>
              {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.region}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Gym</label>
            <input className="input" placeholder="e.g. Basecamp Bouldering" value={form.location_name} onChange={(e) => set('location_name', e.target.value)} required />
            <button type="button" onClick={geo.locate} className="mt-2 flex items-center gap-1.5 text-xs text-ink-300 hover:text-chalk">
              <LocateFixed className="size-3.5" />
              {geo.coords ? 'Location attached, so nearby climbers can find you' : geo.locating ? 'Locating…' : 'Attach my location (optional)'}
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" min={todayISO()} value={form.climb_on} onChange={(e) => set('climb_on', e.target.value)} required />
          </div>
          <div>
            <label className="label">Time</label>
            <select className="input" value={form.time_of_day} onChange={(e) => set('time_of_day', e.target.value as PartnerPostInput['time_of_day'])}>
              {Object.entries(TIME_OF_DAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Styles</label>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <Chip
                key={d}
                active={form.disciplines.includes(d)}
                onClick={() => set('disciplines', form.disciplines.includes(d) ? form.disciplines.filter((x) => x !== d) : [...form.disciplines, d])}
              >
                {DISCIPLINE_LABEL[d]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Grade range</label>
          <input className="input" placeholder="e.g. V3–V6 or 5.10–5.11" value={form.grade_range} onChange={(e) => set('grade_range', e.target.value)} maxLength={40} />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input min-h-20" placeholder="What are you hoping to climb? Gear, car-pooling, experience…" value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={1000} />
        </div>
        {error && <p className="rounded-lg bg-score-nogo/10 px-3 py-2 text-sm text-score-nogo">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Post</Button>
        </div>
      </form>
    </Modal>
  )
}

function PostCard({ post, onChange, mine }: { post: PartnerPost; onChange: (p: PartnerPost) => void; mine: boolean }) {
  const { distance } = useUnits()
  const [open, setOpen] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    try {
      onChange(await api.replyPartner(post.id, reply.trim()))
      setReply('')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="overflow-hidden p-0" layout>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar user={post.user} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/u/${post.user.username}`} className="font-semibold hover:text-chalk">{post.user.display_name}</Link>
              <Badge color={post.setting === 'gym' ? '#6cc4ff' : '#34d399'}>{post.setting === 'gym' ? 'Gym' : 'Outdoor'}</Badge>
              {mine && <Badge color="#c8f560">Your post</Badge>}
              <span className="text-xs text-ink-400">{timeAgo(post.created_at)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
              <MapPin className="size-4 text-ember" />
              {post.area ? <Link to={`/areas/${post.area.id}`} className="hover:text-chalk">{post.location_name}</Link> : post.location_name}
              {post.distance_km !== null && <span className="text-xs font-normal text-ink-400">· {distance(post.distance_km)} away</span>}
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-chalk">{formatDay(post.climb_on, { month: 'short' })}</div>
            <div className="font-display text-2xl font-bold leading-none">{formatDay(post.climb_on, { day: 'numeric' })}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-300">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{relativeDay(post.climb_on)}</span>
          <span className="flex items-center gap-1.5"><Clock className="size-3.5" />{TIME_OF_DAY_LABEL[post.time_of_day]}</span>
          <span>{post.disciplines.map((d) => DISCIPLINE_LABEL[d]).join(' · ')}</span>
          {post.grade_range && <span className="font-semibold text-chalk">{post.grade_range}</span>}
        </div>
        {post.message && <p className="mt-3 text-ink-200">{post.message}</p>}
        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<MessageCircle className="size-3.5" />} onClick={() => setOpen(!open)}>
            {post.replies.length > 0 ? `${post.replies.length} ${post.replies.length === 1 ? 'reply' : 'replies'}` : mine ? 'No replies yet' : "I'm in"}
          </Button>
          {mine && (
            <Button variant="ghost" size="sm" icon={<X className="size-3.5" />} onClick={async () => onChange(await api.closePartner(post.id))}>
              Close post
            </Button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/5 bg-ink-950/30">
            <div className="space-y-3 p-5">
              {post.replies.map((r) => (
                <div key={r.id} className="flex gap-2.5">
                  <Avatar user={r.user} size={30} />
                  <div className="rounded-2xl rounded-tl-sm bg-white/[0.05] px-3 py-2 text-sm">
                    <span className="font-semibold">{r.user.display_name}</span>
                    <span className="ml-2 text-xs text-ink-400">{timeAgo(r.created_at)}</span>
                    <p className="text-ink-200">{r.message}</p>
                  </div>
                </div>
              ))}
              <form onSubmit={send} className="flex gap-2">
                <input className="input" placeholder={mine ? 'Reply…' : "Say hi, share your grade and plans…"} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} />
                <Button type="submit" loading={sending} icon={<Send className="size-4" />} aria-label="Send" />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export function PartnersPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const areaId = params.get('area_id') ? Number(params.get('area_id')) : undefined
  const geo = useGeolocation()
  const toast = useToast()
  const [setting, setSetting] = useState<'all' | 'gym' | 'outdoor'>('all')
  const [discipline, setDiscipline] = useState<Discipline | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: posts, error, loading, reload, setData } = useApi(
    () =>
      api.partners({
        setting: setting === 'all' ? undefined : setting,
        discipline: discipline ?? undefined,
        area_id: areaId,
        lat: geo.coords?.lat,
        lon: geo.coords?.lon,
        radius_km: geo.coords ? 150 : undefined,
      }),
    [setting, discipline, areaId, geo.coords],
  )

  const replace = (p: PartnerPost) =>
    setData((prev) => (p.status === 'closed' ? (prev ?? []).filter((x) => x.id !== p.id) : (prev ?? []).map((x) => (x.id === p.id ? p : x))))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="Partner finder"
        title="Never climb alone"
        subtitle="Find a belayer at your gym or a crew for the crag. Post your plans, or jump in on someone else's."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New post</Button>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented value={setting} onChange={setSetting} options={[{ value: 'all', label: 'All' }, { value: 'gym', label: 'Gym' }, { value: 'outdoor', label: 'Outdoor' }]} />
        <div className="flex flex-wrap gap-2">
          {DISCIPLINES.map((d) => (
            <Chip key={d} active={discipline === d} onClick={() => setDiscipline(discipline === d ? null : d)}>{DISCIPLINE_LABEL[d]}</Chip>
          ))}
        </div>
        <div className="ml-auto">
          {geo.coords ? (
            <Button variant="secondary" size="sm" icon={<X className="size-3.5" />} onClick={geo.clear}>Within 150 km</Button>
          ) : (
            <Button variant="secondary" size="sm" icon={<LocateFixed className="size-3.5" />} loading={geo.locating} onClick={geo.locate}>Near me</Button>
          )}
        </div>
      </div>
      {areaId && posts?.[0]?.area && (
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-300">
          Showing posts for <span className="font-semibold text-white">{posts[0].area.name}</span>
          <Link to="/partners" className="text-chalk hover:underline">Show all</Link>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !posts && <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>}
      {posts && posts.length === 0 && (
        <Card>
          <EmptyState
            icon={<Handshake className="size-6" />}
            title="No open posts match"
            body="Be the first: post when and where you want to climb."
            action={<Button onClick={() => setCreating(true)}>Create a post</Button>}
          />
        </Card>
      )}
      <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
        {posts?.map((p) => (
          <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
            <PostCard post={p} mine={p.user.id === user?.id} onChange={replace} />
          </motion.div>
        ))}
      </motion.div>

      <NewPostModal
        open={creating}
        onClose={() => setCreating(false)}
        defaultAreaId={areaId}
        onCreated={(p) => {
          setData((prev) => [p, ...(prev ?? [])].sort((a, b) => a.climb_on.localeCompare(b.climb_on)))
          toast.show('Posted! Climbers can now reply ✓')
        }}
      />
      <Toast message={toast.message} />
    </div>
  )
}
