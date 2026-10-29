import { Award, CalendarDays, Check, Clock, MapPin, Pencil, TrendingUp, UserMinus, UserPlus, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { api } from '../api/endpoints'
import { GradePyramid } from '../components/charts'
import { Avatar, Badge, Button, Card, ErrorState, Modal, Segmented, Skeleton, StatTile, stagger } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../hooks/useAuth'
import { STYLE_META, formatDay } from '../lib/format'
import type { Me } from '../types'

function EditProfileModal({ open, onClose, me, onSaved }: { open: boolean; onClose: () => void; me: Me; onSaved: (m: Me) => void }) {
  const { data: areas } = useApi(() => api.areas({ sort: 'name' }), [])
  const [displayName, setDisplayName] = useState(me.display_name)
  const [bio, setBio] = useState(me.bio)
  const [homeArea, setHomeArea] = useState<number | null>(me.home_area?.id ?? null)
  const [hue, setHue] = useState(me.avatar_hue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await api.updateMe({ display_name: displayName, bio, home_area_id: homeArea, avatar_hue: hue }))
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar user={{ ...me, display_name: displayName || me.display_name, avatar_hue: hue }} size={64} link={false} />
          <div className="flex-1">
            <label className="label">Avatar color</label>
            <input type="range" min={0} max={359} value={hue} onChange={(e) => setHue(Number(e.target.value))} className="w-full accent-[#c8f560]" />
          </div>
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required />
        </div>
        <div>
          <label className="label">Home area</label>
          <select className="input" value={homeArea ?? ''} onChange={(e) => setHomeArea(e.target.value ? Number(e.target.value) : null)}>
            <option value="">None</option>
            {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="What do you love to climb?" />
        </div>
        {error && <p className="text-sm text-score-nogo">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

export function ProfilePage() {
  const { username = '' } = useParams()
  const { user: me, setUser } = useAuth()
  const { data: profile, error, reload, setData } = useApi(() => api.profile(username), [username])
  const { data: ascents } = useApi(() => api.ascents(username), [username])
  const { data: analytics } = useApi(() => api.analytics(username), [username])
  const [system, setSystem] = useState<'route' | 'boulder'>('route')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  if (error) return <div className="mx-auto max-w-5xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>
  if (!profile) return <div className="mx-auto max-w-5xl space-y-6 px-4 py-10"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>

  const { user, friend, stats } = profile
  const isMe = friend.status === 'self'

  const friendAction = async () => {
    setBusy(true)
    try {
      if (friend.status === 'none' || friend.status === 'incoming') {
        const next = await api.addFriend(user.username)
        setData({ ...profile, friend: next, friend_count: profile.friend_count + (next.status === 'friends' ? 1 : 0) })
      } else if (friend.friendship_id) {
        await api.removeFriend(friend.friendship_id)
        setData({ ...profile, friend: { status: 'none', friendship_id: null }, friend_count: profile.friend_count - (friend.status === 'friends' ? 1 : 0) })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Card className="relative mb-6 overflow-hidden p-6 sm:p-8">
        <div
          className="absolute inset-x-0 top-0 h-28 opacity-50"
          style={{ background: `linear-gradient(120deg, hsl(${user.avatar_hue} 80% 50% / .35), transparent 70%)` }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <Avatar user={user} size={96} link={false} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">{user.display_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-300">
              <span>@{user.username}</span>
              {user.home_area && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{user.home_area.name}</span>}
              <span className="flex items-center gap-1"><Users className="size-3.5" />{profile.friend_count} friends</span>
              <span className="flex items-center gap-1"><Clock className="size-3.5" />Joined {formatDay(user.created_at, { month: 'short', year: 'numeric' })}</span>
            </div>
            {user.bio && <p className="mt-3 max-w-2xl text-ink-200">{user.bio}</p>}
          </div>
          {isMe && me ? (
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Edit profile</Button>
          ) : (
            <Button
              variant={friend.status === 'none' || friend.status === 'incoming' ? 'primary' : 'secondary'}
              loading={busy}
              onClick={friendAction}
              icon={
                friend.status === 'friends' ? <UserMinus className="size-4" /> : friend.status === 'incoming' ? <Check className="size-4" /> : <UserPlus className="size-4" />
              }
            >
              {{ none: 'Add friend', incoming: 'Accept request', outgoing: 'Cancel request', friends: 'Unfriend', self: '' }[friend.status]}
            </Button>
          )}
        </div>
      </Card>

      <motion.div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={stagger.container} initial="hidden" animate="show">
        <StatTile icon={<TrendingUp className="size-4" />} label="Sends" value={stats.totals.sends} />
        <StatTile icon={<CalendarDays className="size-4" />} label="Days out" value={stats.totals.days} accent="#6cc4ff" />
        <StatTile icon={<Award className="size-4" />} label="Hardest route" value={stats.hardest.route?.grade ?? '–'} sub={stats.hardest.route?.name} accent="#ff8a4c" />
        <StatTile icon={<Award className="size-4" />} label="Hardest boulder" value={stats.hardest.boulder?.grade ?? '–'} sub={stats.hardest.boulder?.name} accent="#a78bfa" />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Grade pyramid</h3>
            <Segmented value={system} onChange={setSystem} options={[{ value: 'route', label: 'Routes' }, { value: 'boulder', label: 'Boulders' }]} />
          </div>
          {analytics ? <GradePyramid rows={analytics.pyramid[system]} boulder={system === 'boulder'} /> : <Skeleton className="h-64" />}
        </Card>
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/5 px-6 py-4 text-lg font-semibold">Recent climbs</div>
          <div className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
            {ascents?.slice(0, 25).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-6 py-3">
                <span className="w-14 shrink-0 font-display font-bold text-chalk">{a.grade}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-ink-400">{formatDay(a.climbed_on)} · {a.venue}</div>
                </div>
                <Badge color={STYLE_META[a.style].color}>{STYLE_META[a.style].short}</Badge>
              </div>
            ))}
            {ascents?.length === 0 && <div className="p-8 text-center text-sm text-ink-400">No climbs logged yet</div>}
            {!ascents && <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
          </div>
        </Card>
      </div>

      {isMe && me && (
        <EditProfileModal
          open={editing}
          onClose={() => setEditing(false)}
          me={me}
          onSaved={(m) => {
            setUser(m)
            setData({ ...profile, user: m })
          }}
        />
      )}
    </div>
  )
}
