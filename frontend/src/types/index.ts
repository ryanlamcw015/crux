// Mirrors the backend Pydantic schemas (backend/app/schemas).

export type GradeSystem = 'yds' | 'v'
export type Discipline = 'sport' | 'trad' | 'boulder' | 'tr'
export type Style = 'onsight' | 'flash' | 'redpoint' | 'send' | 'repeat' | 'attempt'

export interface AreaRef {
  id: number
  name: string
  region: string
}

export interface User {
  id: number
  username: string
  display_name: string
  bio: string
  avatar_hue: number
  home_area: AreaRef | null
  created_at: string
}

export interface Me extends User {
  email: string
  is_demo: boolean
}

export interface ConditionsBrief {
  score: number
  label: string
  temp_c: number
  precip_prob: number
  wet: boolean
}

export interface AreaSummary {
  id: number
  name: string
  region: string
  lat: number
  lon: number
  rock_type: string
  route_count: number
  crag_count: number
  conditions: ConditionsBrief | null
  distance_km: number | null
}

export interface CragSummary {
  id: number
  area_id: number
  name: string
  lat: number
  lon: number
  aspect_deg: number | null
  rock_type: string | null
  route_count: number
  conditions: ConditionsBrief | null
}

export interface Route {
  id: number
  name: string
  grade: string
  grade_system: GradeSystem
  discipline: Discipline
  safety: string | null
  crag_id: number
  crag_name: string
  area_id: number
  area_name: string
}

export interface HourScore {
  time: string
  score: number
  is_day: boolean
  temp_c: number
  rock_temp_c: number
  humidity: number
  precip_mm: number
  precip_prob: number
  wind_kmh: number
  cloud: number
  in_sun: boolean | null
  wet: boolean
}

export interface Forecast {
  score: number
  label: string
  now: HourScore
  reasons: { tone: 'good' | 'bad' | 'info'; text: string }[]
  rock: { type: string; label: string; dry_hours: number; soft_when_wet: boolean; note: string; seeps?: boolean }
  best_windows: { start: string; end: string; avg_score: number; peak_score: number }[]
  days: { date: string; best_score: number; best_time: string; high_c: number; low_c: number; rain_mm: number }[]
  hourly: HourScore[]
}

export interface AreaDetail extends AreaSummary {
  description: string
  crags: CragSummary[]
  forecast: Forecast | null
}

export interface CragDetail extends CragSummary {
  area: AreaSummary
  routes: Route[]
  forecast: Forecast | null
}

export interface Ascent {
  id: number
  user_id: number
  route_id: number | null
  name: string
  grade: string
  grade_system: GradeSystem
  discipline: Discipline
  venue: string
  is_gym: boolean
  climbed_on: string
  style: Style
  attempts: number
  rating: number | null
  notes: string
  created_at: string
}

export interface AscentInput {
  route_id?: number | null
  name?: string
  grade?: string
  discipline?: Discipline
  venue?: string
  is_gym?: boolean
  climbed_on: string
  style: Style
  attempts: number
  rating: number | null
  notes: string
}

export interface PyramidRow {
  grade: string
  index: number
  total: number
  onsight: number
  flash: number
  redpoint: number
}

export interface TrendRow {
  month: string
  sends: number
  attempts: number
  days: number
  max_route: string | null
  max_boulder: string | null
  max_route_index: number | null
  max_boulder_index: number | null
}

export interface HardestSend {
  name: string
  grade: string
  date: string
  style: Style
}

export interface Analytics {
  totals: {
    ascents: number
    sends: number
    days: number
    outdoor: number
    gym: number
    venues: number
    weekly_streak: number
  }
  hardest: { route: HardestSend | null; boulder: HardestSend | null }
  hardest_recent: { route: HardestSend | null; boulder: HardestSend | null }
  pyramid: { route: PyramidRow[]; boulder: PyramidRow[] }
  trend: TrendRow[]
  styles: Partial<Record<Style, number>>
  disciplines: Partial<Record<Discipline, number>>
}

export interface Reply {
  id: number
  user: User
  message: string
  created_at: string
}

export interface PartnerPost {
  id: number
  user: User
  setting: 'gym' | 'outdoor'
  area: AreaRef | null
  location_name: string
  lat: number | null
  lon: number | null
  climb_on: string
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'all-day'
  disciplines: Discipline[]
  grade_range: string
  message: string
  status: 'open' | 'closed'
  created_at: string
  replies: Reply[]
  distance_km: number | null
}

export interface PartnerPostInput {
  setting: 'gym' | 'outdoor'
  area_id: number | null
  location_name: string
  lat: number | null
  lon: number | null
  climb_on: string
  time_of_day: PartnerPost['time_of_day']
  disciplines: Discipline[]
  grade_range: string
  message: string
}

export interface Activity {
  id: number
  kind: 'ascent' | 'partner_post' | 'friend'
  created_at: string
  user: User
  other_user: User | null
  ascent: Ascent | null
  partner_post: PartnerPost | null
  kudos_count: number
  kudoed_by_me: boolean
}

export type FriendStatus = 'none' | 'friends' | 'outgoing' | 'incoming' | 'self'

export interface FriendEntry {
  friendship_id: number
  user: User
}

export interface FriendsList {
  friends: FriendEntry[]
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
}

export interface Profile {
  user: User
  friend: { status: FriendStatus; friendship_id: number | null }
  stats: Pick<Analytics, 'totals' | 'hardest'>
  friend_count: number
}

export interface Meta {
  grades: Record<GradeSystem, string[]>
  rock_types: Record<string, { label: string; note: string }>
  styles: Style[]
  disciplines: Discipline[]
}
