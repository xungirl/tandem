import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, useApi } from '../api/client'
import { useAuth, useHobby } from '../state/auth'
import { PlaceMap } from '../components/MapView'
import { Avatar, ErrorNote, PageHeader, Skeleton, toast } from '../components/ui'
import { categoryColor, costLabel, dayLabel, levelLabel, parseDate, timeLabel } from '../lib/format'

export default function ActivityDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { me } = useAuth()
  const { data: a, error, loading, reload } = useApi(() => api.activity(id!), [id])
  const h = useHobby(a?.hobby_id)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [rating, setRating] = useState(0)
  const [rateNote, setRateNote] = useState('')

  if (error) return <><PageHeader title="Activity" back /><ErrorNote message={error} onRetry={reload} /></>
  if (loading || !a) return (
    <><PageHeader title="Activity" back /><div className="space-y-4 p-4"><Skeleton className="h-44" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /></div></>
  )

  const isHost = me?.id === a.host.id || a.my_status === 'host'
  const going = a.my_status === 'going'
  const full = a.capacity != null && a.going_count >= a.capacity
  const start = parseDate(a.starts_at)
  const end = parseDate(a.ends_at)
  const now = Date.now()
  const checkedIn = a.checked_in ?? false
  const canCheckIn = a.can_check_in ?? ((going || isHost) && !checkedIn && now >= start.getTime() - 30 * 60e3 && now <= end.getTime() + 2 * 3600e3)
  const canRate = a.is_past && checkedIn && !a.my_rating && !isHost

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    try { await fn(); toast(done); reload() } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong') } finally { setBusy(false) }
  }

  async function join() {
    setBusy(true)
    try {
      const r = await api.join(a!.id, note.trim() || undefined)
      toast(r.status === 'going' ? "You're going 🎉" : r.status === 'requested' ? 'Request sent to the host' : 'Added to the waitlist')
      reload()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not join') } finally { setBusy(false) }
  }

  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(a.title)}&dates=${start.toISOString().replace(/[-:]|\.\d{3}/g, '')}/${end.toISOString().replace(/[-:]|\.\d{3}/g, '')}&location=${encodeURIComponent([a.venue_name, a.neighborhood, 'Seattle'].filter(Boolean).join(', '))}`
  const approximate = a.location_privacy === 'area' && !going && !isHost

  return (
    <main>
      <PageHeader title={h.name} back right={
        a.chat_id ? <Link to={`/chats/${a.chat_id}`} className="btn btn-ghost btn-sm">💬 Chat</Link> : undefined
      } />

      <div className="relative border-b-2 border-ink">
        <PlaceMap lat={a.lat} lng={a.lng} emoji={h.emoji} approximate={approximate} className="h-48" />
        <div className="absolute -bottom-6 left-4 z-[500] grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink text-3xl shadow-[3px_3px_0_#1F1A17]" style={{ background: categoryColor(h.category) }}>{h.emoji}</div>
      </div>

      <div className="space-y-5 px-4 pt-9 pb-6">
        {a.cancelled && <div className="sticker bg-coral-soft p-3 text-sm font-semibold">The host cancelled this activity. The group chat stays readable.</div>}

        <div>
          <h1 className="font-display text-3xl leading-tight font-extrabold">{a.title}</h1>
          <Link to={`/people/${a.host.id}`} className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
            <Avatar user={a.host} size={26} />
            Hosted by {a.host.display_name}{a.host.is_business && <span className="rounded-full border border-ink bg-sun-soft px-1.5 text-[10px] font-bold">Local spot</span>}
            {a.avg_rating ? <span className="font-mono text-xs text-ink-soft">⭐ {a.avg_rating.toFixed(1)} ({a.rating_count})</span> : null}
          </Link>
        </div>

        <dl className="sticker grid grid-cols-2 divide-x-2 divide-y-2 divide-ink overflow-hidden">
          <Fact k="When" v={`${dayLabel(a.starts_at)}`} sub={`${timeLabel(a.starts_at)} – ${timeLabel(a.ends_at)}${a.recurring_weekly ? ' · weekly' : ''}`} />
          <Fact k="Where" v={a.venue_name || a.neighborhood || 'Seattle'} sub={approximate ? `${a.neighborhood} · exact spot shared once you're in` : a.neighborhood ?? ''} />
          <Fact k="Cost" v={costLabel(a.cost_cents)} sub={a.cost_cents ? 'Paid at the activity' : 'No charge'} />
          <Fact k="Level" v={levelLabel(a.level)} sub={(a.capacity ? `${a.going_count} of ${a.capacity} spots taken` : `${a.going_count} going · no limit`) + (a.waitlist_count ? ` · ${a.waitlist_count} waiting` : '')} />
        </dl>

        {a.description && <p className="leading-relaxed whitespace-pre-line">{a.description}</p>}

        {/* Primary action */}
        {!a.cancelled && !a.is_past && !isHost && (
          <div className="sticker space-y-3 bg-sun-soft p-4">
            {!a.my_status && (
              <>
                {a.requires_approval && (
                  <input className="input text-sm" placeholder="A note for the host (optional, only they see it)" value={note} onChange={e => setNote(e.target.value)} />
                )}
                <button type="button" className="btn btn-primary w-full py-3" onClick={join} disabled={busy}>
                  {full ? 'Join the waitlist' : a.requires_approval ? 'Ask to join' : "I'm going"}
                </button>
                {a.requires_approval && <p className="text-xs text-ink-soft">The host approves everyone for this one.</p>}
              </>
            )}
            {a.my_status && (
              <div className="flex items-center gap-3">
                <div className="flex-1 font-display text-lg font-bold">
                  {going ? "You're going 🎉" : a.my_status === 'requested' ? 'Waiting on the host' : a.my_status === 'waitlist' ? "You're on the waitlist" : 'Not this time'}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api.leave(a.id), 'You left this activity')}>
                  {a.my_status === 'requested' ? 'Take it back' : 'Leave'}
                </button>
              </div>
            )}
            {going && <a href={gcal} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold underline">Add to Google Calendar</a>}
          </div>
        )}

        {checkedIn && !a.is_past && <p className="text-center text-sm font-semibold text-teal">✓ Checked in</p>}
        {canCheckIn && (
          <button type="button" className="btn btn-dark w-full py-3" disabled={busy} onClick={() => act(() => api.checkin(a.id), 'Checked in. Badge progress +1')}>📍 I'm here: check in</button>
        )}

        {canRate && (
          <div className="sticker space-y-3 p-4">
            <h2 className="font-display text-lg font-bold">How was it?</h2>
            <div className="flex gap-2" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)}
                  className={`text-3xl transition ${n <= rating ? 'scale-110' : 'opacity-30 grayscale'}`} aria-label={`${n} star${n > 1 ? 's' : ''}`}>⭐</button>
              ))}
            </div>
            <input className="input text-sm" placeholder="Anything for the host? (optional, only they see it)" value={rateNote} onChange={e => setRateNote(e.target.value)} />
            <button type="button" className="btn btn-primary w-full" disabled={!rating || busy} onClick={() => act(() => api.rate(a.id, rating, rateNote.trim() || undefined), 'Thanks. Your stars help people pick good activities')}>Send rating</button>
          </div>
        )}
        {a.my_rating ? <p className="text-sm text-ink-soft">You rated this {'⭐'.repeat(a.my_rating)}</p> : null}

        {/* Host tools */}
        {isHost && a.requests && a.requests.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-extrabold">Requests to join ({a.requests.length})</h2>
            <ul className="space-y-2">
              {a.requests.map(r => (
                <li key={r.id} className="sticker flex items-center gap-3 p-3">
                  <Avatar user={r} size={40} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/people/${r.id}`} className="font-semibold">{r.display_name}</Link>
                    {r.note && <p className="truncate text-xs text-ink-soft">“{r.note}”</p>}
                  </div>
                  <button type="button" className="btn btn-sm bg-teal" disabled={busy} onClick={() => act(() => api.decide(a.id, r.id, true), `${r.display_name} is in`)}>Approve</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => api.decide(a.id, r.id, false), 'Declined')} aria-label="Decline">✕</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold">Who's going <span className="font-mono text-sm text-ink-soft">{a.going_count}</span></h2>
          {a.attendees.length === 0 ? <p className="text-sm text-ink-soft">Nobody yet. Be the first.</p> : (
            <div className="grid grid-cols-4 gap-3">
              {a.attendees.map(p => (
                <Link key={p.id} to={`/people/${p.id}`} className="flex flex-col items-center gap-1 text-center">
                  <Avatar user={p} size={52} ring={a.friends_going.some(f => f.id === p.id) ? '#1FA59A' : undefined} />
                  <span className="w-full truncate text-xs font-semibold">{p.display_name}</span>
                  {p.is_host && <span className="rounded-full border border-ink bg-sun px-1.5 text-[10px] font-bold">Host</span>}
                  {typeof p.score === 'number' && p.id !== me?.id && <span className="font-mono text-[10px] text-ink-soft">{Math.round(p.score)} match</span>}
                </Link>
              ))}
            </div>
          )}
        </section>

        {isHost && !a.cancelled && !a.is_past && (
          <button type="button" className="w-full py-2 text-sm font-semibold text-coral underline" disabled={busy}
            onClick={() => { if (confirm('Cancel this activity? Everyone going will be told.')) act(() => api.cancelActivity(a.id), 'Activity cancelled').then(() => nav('/')) }}>
            Cancel this activity
          </button>
        )}
      </div>
    </main>
  )
}

function Fact({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="p-3">
      <dt className="font-mono text-[10px] font-bold tracking-wider text-ink-soft uppercase">{k}</dt>
      <dd className="font-display leading-tight font-bold">{v}</dd>
      {sub && <dd className="mt-0.5 text-xs text-ink-soft">{sub}</dd>}
    </div>
  )
}
