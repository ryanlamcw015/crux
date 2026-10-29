import { Check, Search, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/endpoints'
import { Avatar, Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import type { FriendEntry, User } from '../types'

function PersonRow({ user, children }: { user: User; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Avatar user={user} size={40} />
      <Link to={`/u/${user.username}`} className="min-w-0 flex-1">
        <div className="truncate font-semibold hover:text-chalk">{user.display_name}</div>
        <div className="truncate text-xs text-ink-400">@{user.username}{user.home_area && ` · ${user.home_area.name}`}</div>
      </Link>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  )
}

export function PeoplePage() {
  const { user: me } = useAuth()
  const { data: friends, reload } = useApi(() => api.friends(), [])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[] | null>(null)

  useEffect(() => {
    const t = setTimeout(() => api.users(q.trim()).then(setResults).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [q])

  const relation = (u: User): 'friends' | 'incoming' | 'outgoing' | 'none' => {
    if (friends?.friends.some((f) => f.user.id === u.id)) return 'friends'
    if (friends?.incoming.some((f) => f.user.id === u.id)) return 'incoming'
    if (friends?.outgoing.some((f) => f.user.id === u.id)) return 'outgoing'
    return 'none'
  }

  const act = async (fn: () => Promise<unknown>) => {
    await fn()
    reload()
  }

  const section = (title: string, list: FriendEntry[], actions: (f: FriendEntry) => React.ReactNode) =>
    list.length > 0 && (
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/5 px-5 py-3 text-sm font-semibold">{title} <span className="text-ink-400">· {list.length}</span></div>
        <div className="divide-y divide-white/5">
          {list.map((f) => (
            <PersonRow key={f.friendship_id} user={f.user}>{actions(f)}</PersonRow>
          ))}
        </div>
      </Card>
    )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="People" title="Your climbing crew" subtitle="Add friends to see their sends in your feed and compare progress." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {!friends && <Skeleton className="h-48" />}
          {friends && section('Friend requests', friends.incoming, (f) => (
            <>
              <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => act(() => api.addFriend(f.user.username))}>Accept</Button>
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => act(() => api.removeFriend(f.friendship_id))} aria-label="Decline" />
            </>
          ))}
          {friends && section('Friends', friends.friends, (f) => (
            <Button size="sm" variant="ghost" icon={<UserMinus className="size-3.5" />} onClick={() => act(() => api.removeFriend(f.friendship_id))} aria-label="Remove friend" />
          ))}
          {friends && section('Sent requests', friends.outgoing, (f) => (
            <Button size="sm" variant="ghost" onClick={() => act(() => api.removeFriend(f.friendship_id))}>Cancel</Button>
          ))}
          {friends && friends.friends.length + friends.incoming.length + friends.outgoing.length === 0 && (
            <Card><EmptyState icon={<Users className="size-6" />} title="No friends yet" body="Search for climbers to add them." /></Card>
          )}
        </div>
        <Card className="h-fit overflow-hidden p-0">
          <div className="border-b border-white/5 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-400" />
              <input className="input pl-9" placeholder="Search climbers by name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <motion.div className="divide-y divide-white/5" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}>
            {results?.filter((u) => u.id !== me?.id).map((u) => {
              const rel = relation(u)
              return (
                <motion.div key={u.id} variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
                  <PersonRow user={u}>
                    {rel === 'none' && <Button size="sm" variant="secondary" icon={<UserPlus className="size-3.5" />} onClick={() => act(() => api.addFriend(u.username))}>Add</Button>}
                    {rel === 'incoming' && <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => act(() => api.addFriend(u.username))}>Accept</Button>}
                    {rel === 'outgoing' && <span className="text-xs text-ink-400">Requested</span>}
                    {rel === 'friends' && <span className="text-xs font-semibold text-chalk">Friends</span>}
                  </PersonRow>
                </motion.div>
              )
            })}
            {results?.length === 0 && <div className="p-6 text-center text-sm text-ink-400">No climbers found</div>}
          </motion.div>
        </Card>
      </div>
    </div>
  )
}
