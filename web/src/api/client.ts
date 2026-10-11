import { useEffect, useRef, useState } from 'react'
import type {
  ActivityCard, ActivityDetail, AvailabilitySlot, Badge, ChatSummary, FriendsResponse,
  GroupSuggestion, Hobby, Me, Message, Neighborhood, NewActivity, PersonDetail, UserCard,
  UserHobby, VibeQuestion,
} from './types'

export * from './types'

const TOKEN_KEY = 'tandem.token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable */ }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

function qs(q?: Query) {
  if (!q) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn }

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api${path}${qs(query)}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && onUnauthorized) onUnauthorized()
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') msg = data.detail
      else if (Array.isArray(data.detail) && data.detail[0]?.msg) msg = data.detail[0].msg
    } catch { /* not json */ }
    throw new ApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const get = <T,>(p: string, q?: Query) => request<T>('GET', p, undefined, q)
const post = <T,>(p: string, b?: unknown) => request<T>('POST', p, b ?? {})
const patch = <T,>(p: string, b: unknown) => request<T>('PATCH', p, b)
const put = <T,>(p: string, b: unknown) => request<T>('PUT', p, b)
const del = <T,>(p: string) => request<T>('DELETE', p)

export const api = {
  // auth
  requestCode: (email: string) => post<{ sent: boolean; dev_code?: string }>('/auth/request-code', { email }),
  verify: (email: string, code: string) => post<{ token: string; user: Me; is_new: boolean }>('/auth/verify', { email, code }),
  demo: () => post<{ token: string; user: Me }>('/auth/demo'),

  // me
  me: () => get<Me>('/me'),
  updateMe: (b: Partial<Me>) => patch<Me>('/me', b),
  setHobbies: (h: UserHobby[]) => put<unknown>('/me/hobbies', h),
  setAvailability: (a: AvailabilitySlot[]) => put<unknown>('/me/availability', a),
  setVibe: (answers: { question_id: string; option_id: string }[]) =>
    put<{ vibe: Record<string, number>; summary: string }>('/me/vibe', { answers }),
  parseHobbies: (text: string) => post<{ hobbies: UserHobby[]; used_ai: boolean }>('/me/parse-hobbies', { text }),

  // reference
  hobbies: (q?: string) => get<Hobby[]>('/hobbies', { q }),
  addHobby: (name: string, emoji?: string) => post<Hobby>('/hobbies', { name, emoji }),
  neighborhoods: () => get<Neighborhood[]>('/neighborhoods'),
  vibeQuestions: () => get<VibeQuestion[]>('/vibe-questions'),

  // people
  people: (q?: { q?: string; limit?: number; hobby?: string; age_min?: number; age_max?: number; max_km?: number }) => get<UserCard[]>('/people', q),
  person: (id: number | string) => get<PersonDetail>(`/people/${id}`),

  // friends
  friends: () => get<FriendsResponse>('/friends'),
  addFriend: (id: number) => post<unknown>(`/friends/${id}`),
  removeFriend: (id: number) => del<unknown>(`/friends/${id}`),
  addByCode: (code: string) => post<unknown>('/friends/code', { code }),

  // activities
  activities: (q?: { hobby?: string; day?: string; q?: string; mine?: 'hosting' | 'going' | 'past' }) => get<ActivityCard[]>('/activities', q),
  activity: (id: number | string) => get<ActivityDetail>(`/activities/${id}`),
  createActivity: (b: NewActivity) => post<ActivityDetail>('/activities', b),
  cancelActivity: (id: number) => post<unknown>(`/activities/${id}/cancel`),
  join: (id: number, note?: string) => post<{ status: string }>(`/activities/${id}/join`, { note }),
  leave: (id: number) => post<unknown>(`/activities/${id}/leave`),
  decide: (id: number, userId: number, approve: boolean) => post<unknown>(`/activities/${id}/requests/${userId}`, { approve }),
  checkin: (id: number) => post<unknown>(`/activities/${id}/checkin`),
  rate: (id: number, rating: number, note?: string) => post<unknown>(`/activities/${id}/rate`, { rating, note }),

  // suggestions
  suggestions: () => get<GroupSuggestion[]>('/suggestions'),
  acceptSuggestion: (b: { hobby_id: string; weekday: number; slot: string; member_ids: number[] }) =>
    post<{ chat_id: number; suggested_start?: string }>('/suggestions/accept', b),

  // chats
  chats: () => get<ChatSummary[]>('/chats'),
  chat: (id: number | string) => get<ChatSummary>(`/chats/${id}`),
  markRead: (id: number | string) => post<unknown>(`/chats/${id}/read`),
  messages: (id: number | string, before?: number) => get<Message[]>(`/chats/${id}/messages`, { before }),
  send: (id: number | string, body: string) => post<Message>(`/chats/${id}/messages`, { body }),
  createGroup: (member_ids: number[], name?: string) => post<ChatSummary>('/chats', { member_ids, name }),
  dm: (userId: number) => post<ChatSummary>(`/chats/dm/${userId}`),

  badges: () => get<Badge[]>('/badges'),
}

/** Small data hook: loads on mount / when deps change, exposes reload. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let alive = true
    setLoading(true)
    fnRef.current()
      .then(d => { if (alive) { setData(d); setError(null) } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, setData, error, loading, reload: () => setTick(t => t + 1) }
}

/* ---------- WebSocket with auto-reconnect ---------- */

export type WsEvent =
  | { type: 'message'; message: Message }
  | { type: 'typing'; chat_id: number; user?: { id: number; display_name: string } }
  | { type: string; [k: string]: unknown }

type Listener = (e: WsEvent) => void

class Socket {
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private retry = 0
  private timer: number | undefined
  private ping: number | undefined
  private wanted = false

  connect() {
    this.wanted = true
    const token = getToken()
    if (!token || (this.ws && this.ws.readyState <= WebSocket.OPEN)) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 0
      window.clearInterval(this.ping)
      this.ping = window.setInterval(() => this.send({ type: 'ping' }), 25000)
    }
    ws.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data) as WsEvent
        this.listeners.forEach(l => l(data))
      } catch { /* ignore malformed */ }
    }
    ws.onclose = () => {
      this.ws = null
      window.clearInterval(this.ping)
      if (!this.wanted) return
      const delay = Math.min(15000, 500 * 2 ** this.retry++)
      this.timer = window.setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => ws.close()
  }

  disconnect() {
    this.wanted = false
    window.clearTimeout(this.timer)
    this.ws?.close()
    this.ws = null
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data))
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }
}

export const socket = new Socket()

export function useSocket(listener: Listener) {
  const ref = useRef(listener)
  ref.current = listener
  useEffect(() => socket.subscribe(e => ref.current(e)), [])
}
