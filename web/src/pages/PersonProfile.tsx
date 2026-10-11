import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api, useApi } from '../api/client'
import { useAuth } from '../state/auth'
import { ActivityMiniCard } from '../components/ActivityCard'
import { BreakdownBars } from '../components/People'
import { Avatar, BadgeTile, ErrorNote, HobbyChip, PageHeader, ScoreRing, Skeleton, toast } from '../components/ui'
import { LEVELS } from '../lib/format'

export default function PersonProfile() {
  const { id } = useParams()
  const nav = useNavigate()
  const { me } = useAuth()
  const { data: p, error, loading, reload } = useApi(() => api.person(id!), [id])
  const [busy, setBusy] = useState(false)
  const [showMath, setShowMath] = useState(false)

  if (error) return <><PageHeader title="Profile" back /><ErrorNote message={error} onRetry={reload} /></>
  if (loading || !p) return (
    <><PageHeader title="Profile" back /><div className="space-y-4 p-4"><Skeleton className="h-36" /><Skeleton className="h-48" /></div></>
  )

  const isMe = me?.id === p.id || p.friend_status === 'self'
  const shared = p.shared_hobbies.map(s => (typeof s === 'string' ? { hobby_id: s } : s))
  const sharedIds = new Set(shared.map(s => s.hobby_id))
  const first = p.display_name.split(' ')[0]

  async function friendAction() {
    setBusy(true)
    try {
      if (p!.friend_status === 'friends' || p!.friend_status === 'pending_out') {
        if (p!.friend_status === 'friends' && !confirm(`Remove ${first} as a friend?`)) return
        await api.removeFriend(p!.id)
        toast(p!.friend_status === 'friends' ? 'Removed from friends' : 'Request taken back')
      } else {
        await api.addFriend(p!.id)
        toast(p!.friend_status === 'pending_in' ? `You and ${first} are friends now` : 'Friend request sent')
      }
      reload()
    } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong') } finally { setBusy(false) }
  }

  async function message() {
    setBusy(true)
    try { const c = await api.dm(p!.id); nav(`/chats/${c.id}`) } catch (e) { toast(e instanceof Error ? e.message : 'Could not open chat') } finally { setBusy(false) }
  }

  const friendLabel = { none: 'Add friend', pending_out: 'Requested', pending_in: 'Accept request', friends: 'Friends ✓', self: '' }[p.friend_status]

  return (
    <main>
      <PageHeader title={p.display_name} back />
      <section className="relative overflow-hidden border-b-2 border-ink bg-coral-soft px-4 pt-6 pb-5">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full border-2 border-ink bg-sun/60" aria-hidden />
        <div className="relative flex items-end gap-4">
          <Avatar user={p} size={92} />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display text-3xl leading-none font-extrabold">{p.display_name}</h1>
            <p className="mt-1 text-sm font-semibold text-ink-soft">{[p.age, p.neighborhood].filter(Boolean).join(' · ')}</p>
            {p.languages && p.languages.length > 0 && <p className="text-xs text-ink-soft">Speaks {p.languages.join(', ')}</p>}
          </div>
        </div>
        {p.bio && <p className="relative mt-4 leading-snug">{p.bio}</p>}
        {p.instagram && <a className="relative mt-1 inline-block text-sm font-semibold underline" href={`https://instagram.com/${p.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">@{p.instagram.replace('@', '')}</a>}
        {!isMe && (
          <div className="relative mt-4 flex gap-2">
            <button type="button" className={`btn flex-1 ${p.friend_status === 'friends' ? 'bg-teal' : p.friend_status === 'pending_out' ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={friendAction}>{friendLabel}</button>
            <button type="button" className="btn btn-ghost flex-1" disabled={busy} onClick={message}>Message</button>
          </div>
        )}
      </section>

      <div className="space-y-6 px-4 py-5">
        {!isMe && (
          <section className="sticker p-4">
            <div className="flex items-center gap-4">
              <ScoreRing score={p.score} size={84} stroke={9} />
              <div className="flex-1">
                <div className="font-mono text-[11px] font-bold tracking-wider text-ink-soft">FRIEND SCORE</div>
                <p className="font-display text-lg leading-snug font-bold">{p.top_reason || `What you and ${first} have in common`}</p>
              </div>
            </div>
            <button type="button" className="mt-3 w-full rounded-xl border-2 border-dashed border-ink py-2 text-sm font-bold" aria-expanded={showMath} onClick={() => setShowMath(!showMath)}>
              {showMath ? 'Hide the math' : 'See how it adds up'}
            </button>
            {showMath && <div className="mt-4 animate-rise"><BreakdownBars items={p.breakdown} /></div>}
          </section>
        )}

        {shared.length > 0 && !isMe && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold">You both do</h2>
            <ul className="space-y-2">
              {shared.map(s => (
                <li key={s.hobby_id} className="flex items-center justify-between gap-2">
                  <HobbyChip id={s.hobby_id} shared />
                  <span className="text-xs text-ink-soft">
                    {s.my_level && s.their_level ? `You: ${LEVELS[s.my_level]} · ${first}: ${LEVELS[s.their_level]}` : ''}
                    {typeof s.rarity === 'number' && s.rarity > 0.6 ? ' · rare 💎' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold">{isMe ? 'Your' : `${first}'s`} hobbies</h2>
          <div className="flex flex-wrap gap-2">
            {p.hobbies.map(h => <HobbyChip key={h.hobby_id} id={h.hobby_id} level={h.level} shared={sharedIds.has(h.hobby_id)} active={sharedIds.has(h.hobby_id) ? true : undefined} />)}
          </div>
        </section>

        {p.badges && p.badges.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold">Badges</h2>
            <div className="grid grid-cols-3 gap-3">{p.badges.map(b => <BadgeTile key={b.hobby_id + b.tier} badge={b} />)}</div>
          </section>
        )}

        {p.upcoming_activities.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold">Going to</h2>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {p.upcoming_activities.map(a => <ActivityMiniCard key={a.id} a={a} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
