import { Link } from 'react-router'
import type { BreakdownItem, GroupSuggestion, UserCard } from '../api/client'
import { useAuth, useHobby } from '../state/auth'
import { SLOT_LABEL, WEEKDAYS_LONG } from '../lib/format'
import { Avatar, HobbyRow, ScoreRing } from './ui'

const BAR_COLORS: Record<string, string> = {
  hobbies: '#FF6B4A', shared_hobbies: '#FF6B4A', time: '#FFC94A', availability: '#FFC94A',
  proximity: '#1FA59A', distance: '#1FA59A', vibe: '#B9A6FF', age: '#FF9CC2',
}
const FALLBACK = ['#FF6B4A', '#FFC94A', '#1FA59A', '#B9A6FF', '#FF9CC2']

export function BreakdownBars({ items }: { items: BreakdownItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((b, i) => {
        const pct = b.max ? Math.max(0, Math.min(1, b.points / b.max)) : 0
        const color = BAR_COLORS[b.key] ?? FALLBACK[i % FALLBACK.length]
        return (
          <li key={b.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{b.label}</span>
              <span className="font-mono text-xs font-bold">{b.points.toFixed(b.points % 1 ? 1 : 0)}<span className="text-ink-soft">/{b.max}</span></span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-paper">
              <div className="h-full origin-left rounded-r-full" style={{ width: `${pct * 100}%`, background: color, animation: `bar-fill 0.8s ${i * 90}ms cubic-bezier(0.2,0.9,0.3,1) both` }} />
            </div>
            {b.detail && <p className="mt-1 text-xs text-ink-soft">{b.detail}</p>}
          </li>
        )
      })}
    </ul>
  )
}

export function PersonRow({ p, i = 0 }: { p: UserCard; i?: number }) {
  const { me } = useAuth()
  const mine = new Set((me?.hobbies ?? []).map(h => h.hobby_id))
  return (
    <Link to={`/people/${p.id}`} className="sticker sticker-press flex items-start gap-3 p-3 animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <Avatar user={p} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-lg font-bold">{p.display_name}</span>
          {p.age ? <span className="text-sm text-ink-soft">{p.age}</span> : null}
          {p.friend_status === 'friends' && <span className="rounded-full border border-ink bg-teal-soft px-1.5 text-[10px] font-bold">Friend</span>}
        </div>
        <div className="text-xs text-ink-soft">{p.neighborhood}</div>
        {p.top_reason && <p className="mt-1 text-sm leading-snug font-medium">{p.top_reason}</p>}
        <div className="mt-2"><HobbyRow hobbies={p.hobbies} sharedIds={mine} max={3} /></div>
      </div>
      <ScoreRing score={p.score} size={52} />
    </Link>
  )
}

export function SuggestionCard({ s, onAccept, busy }: { s: GroupSuggestion; onAccept: () => void; busy?: boolean }) {
  const h = useHobby(s.hobby_id)
  return (
    <div className="sticker flex w-[280px] shrink-0 flex-col gap-3 bg-lilac-soft p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold tracking-wider uppercase">{WEEKDAYS_LONG[s.weekday]} {SLOT_LABEL[s.slot]?.toLowerCase()}</span>
        <span className="rounded-full border-2 border-ink bg-white px-2 font-mono text-[11px] font-bold">{Math.round(s.score)} match</span>
      </div>
      <div className="font-display text-xl leading-tight font-extrabold">{h.emoji} {h.name} crew</div>
      <div className="flex items-center">
        {s.members.map((m, i) => (
          <div key={m.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar user={m} size={36} /></div>
        ))}
        <span className="ml-2 text-sm font-semibold">{s.members.map(m => m.display_name.split(' ')[0]).join(', ')}</span>
      </div>
      {s.reason && <p className="text-sm leading-snug text-ink-soft">{s.reason}</p>}
      <button type="button" className="btn btn-dark btn-sm mt-auto" onClick={onAccept} disabled={busy}>
        {busy ? 'Starting…' : 'Start a group chat'}
      </button>
    </div>
  )
}
