import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import type { Badge, MiniUser, UserHobby } from '../api/client'
import { useHobby } from '../state/auth'
import { LEVELS, TIER_STYLE, categoryColor, scoreColor } from '../lib/format'

/* ---------- Avatar ---------- */

export function Avatar({ user, size = 44, ring }: { user?: Pick<MiniUser, 'avatar' | 'display_name'> | null; size?: number; ring?: string }) {
  const raw = user?.avatar ?? ''
  const name = user?.display_name ?? '?'
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 3px ${ring}` : undefined }
  if (raw.startsWith('http') || raw.startsWith('/') || raw.startsWith('data:')) {
    return <img src={raw} alt="" className="shrink-0 rounded-full border-2 border-ink object-cover" style={style} />
  }
  const [emoji, color] = raw.includes('|') ? raw.split('|') : ['', '']
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border-2 border-ink font-display font-bold"
      style={{ ...style, background: color || '#FFD9CF', fontSize: emoji ? size * 0.5 : size * 0.36 }}
      aria-hidden
    >
      {emoji || initials}
    </div>
  )
}

export function AvatarStack({ users, size = 28, max = 4 }: { users: MiniUser[]; size?: number; max?: number }) {
  const shown = users.slice(0, max)
  const extra = users.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <div key={u.id} style={{ marginLeft: i ? -size * 0.35 : 0, zIndex: max - i }}>
          <Avatar user={u} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div className="grid place-items-center rounded-full border-2 border-ink bg-paper font-mono text-[10px] font-bold"
          style={{ width: size, height: size, marginLeft: -size * 0.35 }}>+{extra}</div>
      )}
    </div>
  )
}

/* ---------- Hobby chip ---------- */

export function HobbyChip({ id, level, active, onClick, size = 'md', shared }: {
  id: string; level?: number; active?: boolean; onClick?: () => void; size?: 'sm' | 'md'; shared?: boolean
}) {
  const h = useHobby(id)
  const color = categoryColor(h.category)
  const cls = `inline-flex items-center gap-1.5 rounded-full border-2 border-ink font-semibold whitespace-nowrap transition ${
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  } ${onClick ? 'cursor-pointer sticker-press' : ''}`
  const style = {
    background: active === false ? 'white' : active ? color : shared ? color : `${color}55`,
    boxShadow: active ? '2px 2px 0 #1F1A17' : undefined,
  }
  const content = (
    <>
      <span aria-hidden>{h.emoji}</span>
      {h.name}
      {level ? <span className="font-mono text-[10px] opacity-70" title={LEVELS[level]}>{'●'.repeat(level)}</span> : null}
    </>
  )
  return onClick
    ? <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={active}>{content}</button>
    : <span className={cls} style={style}>{content}</span>
}

export function HobbyEmoji({ id, size = 40 }: { id: string; size?: number }) {
  const h = useHobby(id)
  return (
    <div className="grid shrink-0 place-items-center rounded-xl border-2 border-ink"
      style={{ width: size, height: size, background: categoryColor(h.category), fontSize: size * 0.5 }} aria-hidden>
      {h.emoji}
    </div>
  )
}

export function HobbyRow({ hobbies, sharedIds, max = 4 }: { hobbies: UserHobby[]; sharedIds?: Set<string>; max?: number }) {
  const sorted = [...hobbies].sort((a, b) => Number(sharedIds?.has(b.hobby_id)) - Number(sharedIds?.has(a.hobby_id)))
  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.slice(0, max).map(h => <HobbyChip key={h.hobby_id} id={h.hobby_id} size="sm" shared={sharedIds?.has(h.hobby_id)} />)}
      {hobbies.length > max && <span className="px-1 text-xs font-semibold text-ink-soft">+{hobbies.length - max}</span>}
    </div>
  )
}

/* ---------- Score ring ---------- */

export function ScoreRing({ score, size = 56, stroke = 6, label = true }: { score: number; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2 - 1
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  const color = scoreColor(score)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Friend Score ${Math.round(score)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="#1F1A17" strokeWidth={stroke + 3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1E4D3" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ ['--circ' as string]: circ, animation: 'ring-fill 0.9s cubic-bezier(0.2,0.9,0.3,1) both' }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 grid place-items-center font-display font-extrabold leading-none" style={{ fontSize: size * 0.32 }}>
          {Math.round(score)}
        </div>
      )}
    </div>
  )
}

/* ---------- Badge tile ---------- */

export function BadgeTile({ badge }: { badge: Badge }) {
  const h = useHobby(badge.hobby_id)
  const t = TIER_STYLE[badge.tier] ?? TIER_STYLE.Bronze
  const progress = badge.next_at ? Math.min(1, badge.count / badge.next_at) : 1
  return (
    <div className="sticker flex flex-col items-center gap-1.5 p-3 text-center animate-pop">
      <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-ink text-2xl"
        style={{ background: t.bg, boxShadow: `inset 0 0 0 4px ${t.ring}` }}>
        {h.emoji}
        {badge.tier === 'Legendary' && <span className="absolute -top-2 -right-1 text-sm">👑</span>}
      </div>
      <div className="font-display text-sm leading-tight font-bold">{h.name}</div>
      <div className="font-mono text-[10px] font-bold tracking-wide uppercase" style={{ color: t.ring }}>{t.label} · {badge.count}</div>
      {badge.next_tier && badge.next_at ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full border border-ink bg-paper" title={`${badge.next_at - badge.count} more to ${badge.next_tier}`}>
          <div className="h-full bg-teal" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
    </div>
  )
}

/* ---------- Layout bits ---------- */

export function PageHeader({ title, back, right, sub }: { title: ReactNode; back?: boolean | string; right?: ReactNode; sub?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-20 border-b-2 border-ink bg-paper/95 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {back && (
          <button type="button" onClick={() => (typeof back === 'string' ? nav(back) : history.length > 1 ? nav(-1) : nav('/'))}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-white sticker-press" aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        {right}
      </div>
      {sub && <div className="mt-2">{sub}</div>}
    </header>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function ListSkeleton({ rows = 4, h = 'h-24' }: { rows?: number; h?: string }) {
  return <div className="space-y-3">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={h} />)}</div>
}

export function Empty({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center animate-rise">
      <div className="mb-3 grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-ink bg-white text-4xl">{emoji}</div>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="sticker m-4 flex items-start gap-3 bg-coral-soft p-4" role="alert">
      <span className="text-xl" aria-hidden>⚠️</span>
      <div className="flex-1 text-sm">
        <div className="font-bold">Couldn't load this</div>
        <div className="text-ink-soft">{message}</div>
      </div>
      {onRetry && <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full border-2 border-ink bg-white p-0.5" role="tablist">
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-full px-3.5 py-1 text-sm font-bold transition ${value === o.value ? 'bg-ink text-paper' : 'text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2">
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-ink-soft">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition ${checked ? 'bg-teal' : 'bg-paper-2'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

/* ---------- Toast ---------- */

let toastListener: ((t: string) => void) | null = null
export function toast(msg: string) { toastListener?.(msg) }

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let timer: number | undefined
    toastListener = m => {
      setMsg(m)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMsg(null), 2600)
    }
    return () => { toastListener = null; window.clearTimeout(timer) }
  }, [])
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div key={msg} className="sticker animate-pop bg-ink px-4 py-2.5 text-sm font-semibold text-paper">{msg}</div>
    </div>
  )
}

/* ---------- Bottom tabs ---------- */

const TABS = [
  { to: '/', label: 'Activities', icon: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  { to: '/people', label: 'People', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10c0-3.9 3.1-7 7-7s7 3.1 7 7M16 3.1a4 4 0 0 1 0 7.8M22 21c0-3.2-2-5.9-5-6.7' },
  { to: '/chats', label: 'Chats', icon: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-5.6A8 8 0 1 1 21 12z' },
  { to: '/me', label: 'Me', icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 10a8 8 0 0 1 16 0' },
]

export function BottomTabs({ unread = 0 }: { unread?: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t-2 border-ink bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      <div className="grid grid-cols-4">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) => `group relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? 'text-ink' : 'text-ink-soft'}`}>
            {({ isActive }) => (
              <>
                <span className={`grid h-8 w-12 place-items-center rounded-full border-2 transition ${isActive ? 'border-ink bg-sun shadow-[2px_2px_0_#1F1A17]' : 'border-transparent'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
                </span>
                {t.label}
                {t.to === '/chats' && unread > 0 && (
                  <span className="absolute top-1 right-[calc(50%-24px)] min-w-5 rounded-full border-2 border-ink bg-coral px-1 font-mono text-[10px] leading-4 text-ink">{unread > 9 ? '9+' : unread}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="btn btn-primary fixed bottom-24 z-30 shadow-[4px_4px_0_#1F1A17]"
      style={{ right: 'max(1rem, calc(50vw - 240px + 1rem))' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      {label}
    </Link>
  )
}
