import type {
  Activity,
  Analytics,
  AreaDetail,
  AreaSummary,
  Ascent,
  AscentInput,
  CragDetail,
  FriendsList,
  FriendStatus,
  Me,
  Meta,
  PartnerPost,
  PartnerPostInput,
  Profile,
  Route,
  User,
} from '../types'
import { request } from './client'

interface TokenOut {
  access_token: string
  user: Me
}

export const api = {
  // auth
  register: (body: { username: string; email: string; password: string; display_name: string }) =>
    request<TokenOut>('POST', '/api/auth/register', { body }),
  login: (login: string, password: string) => request<TokenOut>('POST', '/api/auth/login', { body: { login, password } }),
  demo: () => request<TokenOut>('POST', '/api/auth/demo'),
  me: () => request<Me>('GET', '/api/auth/me'),
  updateMe: (body: Partial<{ display_name: string; bio: string; home_area_id: number | null; avatar_hue: number }>) =>
    request<Me>('PATCH', '/api/auth/me', { body }),

  // places
  meta: () => request<Meta>('GET', '/api/meta'),
  areas: (query: { q?: string; rock_type?: string; lat?: number; lon?: number; radius_km?: number; sort?: string } = {}) =>
    request<AreaSummary[]>('GET', '/api/areas', { query }),
  area: (id: number) => request<AreaDetail>('GET', `/api/areas/${id}`),
  crag: (id: number) => request<CragDetail>('GET', `/api/crags/${id}`),
  setAspect: (id: number, aspect_deg: number | null) =>
    request<CragDetail>('PUT', `/api/crags/${id}/aspect`, { body: { aspect_deg } }),
  routes: (query: {
    q?: string
    area_id?: number
    crag_id?: number
    discipline?: string
    grade_min?: string
    grade_max?: string
    limit?: number
    offset?: number
  }) => request<Route[]>('GET', '/api/routes', { query }),
  route: (id: number) => request<Route>('GET', `/api/routes/${id}`),

  // logbook
  ascents: (username?: string) => request<Ascent[]>('GET', '/api/ascents', { query: { username } }),
  createAscent: (body: AscentInput) => request<Ascent>('POST', '/api/ascents', { body }),
  updateAscent: (id: number, body: AscentInput) => request<Ascent>('PUT', `/api/ascents/${id}`, { body }),
  deleteAscent: (id: number) => request<void>('DELETE', `/api/ascents/${id}`),
  analytics: (username?: string) => request<Analytics>('GET', '/api/analytics', { query: { username } }),

  // social
  users: (q: string) => request<User[]>('GET', '/api/users', { query: { q } }),
  profile: (username: string) => request<Profile>('GET', `/api/users/${username}`),
  friends: () => request<FriendsList>('GET', '/api/friends'),
  addFriend: (username: string) =>
    request<{ status: FriendStatus; friendship_id: number | null }>('POST', `/api/friends/${username}`),
  removeFriend: (friendshipId: number) => request<void>('DELETE', `/api/friends/${friendshipId}`),
  feed: (before_id?: number) => request<Activity[]>('GET', '/api/feed', { query: { before_id } }),
  kudos: (activityId: number, on: boolean) =>
    request<void>(on ? 'POST' : 'DELETE', `/api/feed/${activityId}/kudos`),

  // partners
  partners: (query: {
    setting?: string
    area_id?: number
    discipline?: string
    lat?: number
    lon?: number
    radius_km?: number
  }) => request<PartnerPost[]>('GET', '/api/partners', { query }),
  createPartnerPost: (body: PartnerPostInput) => request<PartnerPost>('POST', '/api/partners', { body }),
  replyPartner: (id: number, message: string) =>
    request<PartnerPost>('POST', `/api/partners/${id}/replies`, { body: { message } }),
  closePartner: (id: number) => request<PartnerPost>('POST', `/api/partners/${id}/close`),
}
