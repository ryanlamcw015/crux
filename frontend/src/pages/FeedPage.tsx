import { Handshake, Heart, MapPin, Rss, Star, UserPlus, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/endpoints'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { DISCIPLINE_LABEL, STYLE_META, TIME_OF_DAY_LABEL, cx, relativeDay, timeAgo } from '../lib/format'
import type { Activity } from '../types'

function KudosButton({ item, onToggle }: { item: Activity; onToggle: (on: boolean) => void }) {
  const [burst, setBurst] = useState(0)
  return (
    <button
      onClick={() => {
        if (!item.kudoed_by_me) setBurst((b) => b + 1)
        onToggle(!item.kudoed_by_me)
      }}
      className={cx(
        'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
        item.kudoed_by_me ? 'bg-rose/15 text-rose' : 'text-ink-300 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      <motion.span key={burst} initial={burst ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
        <Heart className={cx('size-4', item.kudoed_by_me && 'fill-rose')} />
      </motion.span>
      <AnimatePresence>
        {burst > 0 && item.kudoed_by_me && (
          <motion.span
            key={`b${burst}`}
            className="pointer-events-none absolute left-3 top-1 size-4 rounded-full border-2 border-rose"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      {item.kudos_count > 0 ? item.kudos_count : 'Kudos'}
    </button>
  )
}

function ActivityCard({ item, onKudos }: { item: Activity; onKudos: (on: boolean) => void }) {
  const a = item.ascent
  const p = item.partner_post
  return (
    <Card className="p-5" layout>
      <div className="flex gap-3">
        <Avatar user={item.user} size={42} />
        <div className="min-w-0 flex-1">
          <div className="text-sm">
            <Link to={`/u/${item.user.username}`} className="font-semibold hover:text-chalk">{item.user.display_name}</Link>{' '}
            <span className="text-ink-300">
              {item.kind === 'ascent' && a && (a.style === 'attempt' ? 'worked on' : a.style === 'repeat' ? 'repeated' : 'sent')}
              {item.kind === 'partner_post' && 'is looking for a partner'}
              {item.kind === 'friend' && item.other_user && (
                <>
                  is now friends with{' '}
                  <Link to={`/u/${item.other_user.username}`} className="font-semibold text-ink-100 hover:text-chalk">{item.other_user.display_name}</Link>
                </>
              )}
            </span>
          </div>
          <div className="text-xs text-ink-400">{timeAgo(item.created_at)}</div>

          {a && (
            <div className="mt-3 flex items-center gap-4 rounded-xl border border-white/5 bg-ink-950/40 p-4">
              <span className="font-display text-2xl font-bold text-chalk">{a.grade}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{a.name}</span>
                  <Badge color={STYLE_META[a.style].color}>{STYLE_META[a.style].label}</Badge>
                  {a.rating && <span className="flex">{Array.from({ length: a.rating }, (_, i) => <Star key={i} className="size-3 fill-ember text-ember" />)}</span>}
                </div>
                <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-400">
                  <MapPin className="size-3 shrink-0" /> {a.venue} · {DISCIPLINE_LABEL[a.discipline]}
                </div>
                {a.notes && <p className="mt-2 text-sm text-ink-200">“{a.notes}”</p>}
              </div>
            </div>
          )}

          {p && (
            <Link to="/partners" className="mt-3 block rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4 transition hover:border-emerald-400/30">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Handshake className="size-4 text-score-good" /> {p.location_name}
              </div>
              <div className="mt-1 text-xs text-ink-300">
                {relativeDay(p.climb_on)} · {TIME_OF_DAY_LABEL[p.time_of_day]} · {p.disciplines.map((d) => DISCIPLINE_LABEL[d]).join(', ')}
                {p.grade_range && ` · ${p.grade_range}`}
              </div>
              {p.message && <p className="mt-2 text-sm text-ink-200">{p.message}</p>}
            </Link>
          )}

          {item.kind !== 'friend' && (
            <div className="mt-3">
              <KudosButton item={item} onToggle={onKudos} />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export function FeedPage() {
  const { data: feed, error, loading, reload, setData } = useApi(() => api.feed(), [])
  const [loadingMore, setLoadingMore] = useState(false)
  const [done, setDone] = useState(false)

  const toggleKudos = (id: number, on: boolean) => {
    setData((prev) =>
      (prev ?? []).map((i) => (i.id === id ? { ...i, kudoed_by_me: on, kudos_count: i.kudos_count + (on ? 1 : -1) } : i)),
    )
    api.kudos(id, on).catch(reload)
  }

  const loadMore = async () => {
    if (!feed?.length) return
    setLoadingMore(true)
    const older = await api.feed(feed[feed.length - 1].id).finally(() => setLoadingMore(false))
    if (older.length === 0) setDone(true)
    setData([...feed, ...older])
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_280px]">
      <div>
        <PageHeader eyebrow="Feed" title="What your crew is sending" />
        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !feed && <div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>}
        {feed && feed.length === 0 && (
          <Card>
            <EmptyState
              icon={<Rss className="size-6" />}
              title="Quiet in here"
              body="Add friends to see their sends, partner posts and milestones."
              action={<Link to="/people"><Button icon={<UserPlus className="size-4" />}>Find friends</Button></Link>}
            />
          </Card>
        )}
        <motion.div className="space-y-4" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
          {feed?.map((item) => (
            <motion.div key={item.id} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
              <ActivityCard item={item} onKudos={(on) => toggleKudos(item.id, on)} />
            </motion.div>
          ))}
        </motion.div>
        {feed && feed.length >= 30 && !done && (
          <div className="mt-6 text-center">
            <Button variant="secondary" onClick={loadMore} loading={loadingMore}>Load older</Button>
          </div>
        )}
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <Card className="p-5">
            <Users className="mb-3 size-5 text-sky" />
            <h3 className="font-semibold">Grow your crew</h3>
            <p className="mt-1 text-sm text-ink-300">Find climbing friends and see their sends here.</p>
            <Link to="/people"><Button variant="secondary" size="sm" className="mt-4 w-full">Find people</Button></Link>
          </Card>
          <Card className="p-5">
            <Handshake className="mb-3 size-5 text-score-good" />
            <h3 className="font-semibold">Need a belay?</h3>
            <p className="mt-1 text-sm text-ink-300">Post your plans and match with climbers at your gym or crag.</p>
            <Link to="/partners"><Button size="sm" className="mt-4 w-full">Partner finder</Button></Link>
          </Card>
        </div>
      </aside>
    </div>
  )
}
