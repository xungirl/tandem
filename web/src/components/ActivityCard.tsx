import { Link } from 'react-router'
import type { ActivityCard as A } from '../api/client'
import { useHobby } from '../state/auth'
import { categoryColor, costLabel, dateParts, dayLabel, levelLabel, timeLabel } from '../lib/format'
import { AvatarStack } from './ui'

const STATUS_LABEL: Record<string, { text: string; bg: string }> = {
  host: { text: "You're hosting", bg: '#FFC94A' },
  declined: { text: 'Not this time', bg: '#F1E4D3' },
  going: { text: "You're going", bg: '#9BE3B4' },
  requested: { text: 'Requested', bg: '#FFF0C4' },
  waitlist: { text: 'Waitlisted', bg: '#EBE4FF' },
}

/** A ticket stub: date block | perforation | details. */
export function ActivityCard({ a, i = 0, compact }: { a: A; i?: number; compact?: boolean }) {
  const h = useHobby(a.hobby_id)
  const color = categoryColor(h.category)
  const d = dateParts(a.starts_at)
  const full = a.capacity != null && a.going_count >= a.capacity
  const status = a.my_status ? STATUS_LABEL[a.my_status] : null
  return (
    <Link to={`/activities/${a.id}`} className="sticker sticker-press flex overflow-hidden animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <div className="flex w-[68px] shrink-0 flex-col items-center justify-center gap-0.5 border-r-2 border-dashed border-ink py-3" style={{ background: color }}>
        <span className="font-mono text-[10px] font-bold tracking-widest">{d.dow}</span>
        <span className="font-display text-3xl leading-none font-extrabold">{d.day}</span>
        <span className="font-mono text-[10px] font-bold tracking-widest">{d.month}</span>
      </div>
      <div className="perforated min-w-0 flex-1 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <span aria-hidden>{h.emoji}</span>
          <span className="truncate">{h.name}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{timeLabel(a.starts_at)}</span>
          {a.recurring_weekly && <span title="Every week" aria-label="Weekly">↻</span>}
        </div>
        <h3 className="font-display text-[17px] leading-snug font-bold">{a.title}</h3>
        {!compact && (
          <div className="mt-1 truncate text-sm text-ink-soft">
            {a.venue_name || a.neighborhood}{a.venue_name && a.neighborhood ? ` · ${a.neighborhood}` : ''}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {a.cancelled && <span className="rounded-full border-2 border-ink bg-coral-soft px-2 py-0.5 text-[11px] font-bold">Cancelled</span>}
          {status && <span className="rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold" style={{ background: status.bg }}>{status.text}</span>}
          <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold ${a.cost_cents ? 'bg-sun-soft' : 'bg-white'}`}>{costLabel(a.cost_cents)}</span>
          {a.level !== 'any' && <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold">{levelLabel(a.level)}</span>}
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            {a.friends_going.length > 0 && <AvatarStack users={a.friends_going} size={22} max={3} />}
            {full ? 'Full' : a.capacity ? `${a.going_count}/${a.capacity}` : `${a.going_count} going`}
          </span>
        </div>
        {a.friends_going.length > 0 && !compact && (
          <div className="mt-1.5 text-xs font-semibold text-teal">
            {a.friends_going[0].display_name}{a.friends_going.length > 1 ? ` + ${a.friends_going.length - 1} friend${a.friends_going.length > 2 ? 's' : ''}` : ''} going
          </div>
        )}
      </div>
    </Link>
  )
}

export function ActivityMiniCard({ a }: { a: A }) {
  const h = useHobby(a.hobby_id)
  return (
    <Link to={`/activities/${a.id}`} className="sticker sticker-press flex w-56 shrink-0 flex-col gap-1 p-3">
      <div className="text-xs font-semibold text-ink-soft">{h.emoji} {dayLabel(a.starts_at)} · {timeLabel(a.starts_at)}</div>
      <div className="line-clamp-2 font-display leading-snug font-bold">{a.title}</div>
      <div className="truncate text-xs text-ink-soft">{a.neighborhood}</div>
    </Link>
  )
}
