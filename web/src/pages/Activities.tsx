import { useMemo, useState } from 'react'
import { api, useApi } from '../api/client'
import { useAuth } from '../state/auth'
import { ActivityCard } from '../components/ActivityCard'
import { ActivityMap } from '../components/MapView'
import { Empty, ErrorNote, Fab, HobbyChip, ListSkeleton, PageHeader, Segmented } from '../components/ui'
import { dayLabel } from '../lib/format'
import { Link } from 'react-router'

type Day = 'week' | 'today' | 'weekend'
const DAYS: { value: Day; label: string }[] = [
  { value: 'week', label: 'This week' }, { value: 'today', label: 'Today' }, { value: 'weekend', label: 'Weekend' },
]

export default function Activities() {
  const { me } = useAuth()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [day, setDay] = useState<Day>('week')
  const [hobby, setHobby] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const { data, error, loading, reload } = useApi(() => api.activities({ day, hobby: hobby ?? undefined, q: q.trim() || undefined }), [day, hobby, q])
  const mine = useApi(() => api.activities({ mine: 'going' }), [])

  const myHobbies = me?.hobbies ?? []
  const groups = useMemo(() => {
    const out: { label: string; items: NonNullable<typeof data> }[] = []
    for (const a of data ?? []) {
      const label = dayLabel(a.starts_at)
      const g = out[out.length - 1]
      if (g && g.label === label) g.items.push(a)
      else out.push({ label, items: [a] })
    }
    return out
  }, [data])

  const sel = data?.find(a => a.id === selected) ?? null
  const upcomingMine = (mine.data ?? []).slice(0, 5)

  return (
    <main>
      <PageHeader
        title={<span>Seattle, <span className="text-coral">{day === 'today' ? 'today' : day === 'weekend' ? 'this weekend' : 'this week'}</span></span>}
        right={<Segmented value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} />}
        sub={
          <div className="space-y-2">
            <input className="input py-2 text-sm" placeholder="Search activities" value={q} onChange={e => setQ(e.target.value)} aria-label="Search activities" />
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {DAYS.map(d => (
                <button key={d.value} type="button" onClick={() => setDay(d.value)} aria-pressed={day === d.value}
                  className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${day === d.value ? 'bg-ink text-paper' : 'bg-white'}`}>{d.label}</button>
              ))}
              <span className="mx-1 w-0.5 shrink-0 bg-ink/20" />
              {myHobbies.map(h => (
                <HobbyChip key={h.hobby_id} id={h.hobby_id} active={hobby === h.hobby_id} onClick={() => setHobby(hobby === h.hobby_id ? null : h.hobby_id)} />
              ))}
            </div>
          </div>
        }
      />

      {view === 'map' ? (
        <div className="relative h-[calc(100dvh-230px)] border-b-2 border-ink">
          <ActivityMap activities={data ?? []} selectedId={selected} onSelect={setSelected} />
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] px-3">
            <div className="pointer-events-auto">
              {sel ? <ActivityCard a={sel} /> : (
                <div className="sticker bg-white/95 px-4 py-2.5 text-center text-sm font-semibold">
                  {loading ? 'Loading activities…' : `${data?.length ?? 0} activities. Tap a pin to see one.`}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 px-4 py-4">
          {upcomingMine.length > 0 && day === 'week' && !hobby && !q && (
            <section>
              <h2 className="mb-2 font-display text-lg font-extrabold">Your plans</h2>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {upcomingMine.map(a => (
                  <Link key={a.id} to={`/activities/${a.id}`} className="sticker sticker-press w-60 shrink-0 bg-teal-soft p-3">
                    <div className="font-mono text-[11px] font-bold">{dayLabel(a.starts_at).toUpperCase()}</div>
                    <div className="mt-0.5 line-clamp-2 font-display leading-snug font-bold">{a.title}</div>
                    <div className="mt-1 truncate text-xs text-ink-soft">{a.venue_name || a.neighborhood}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {error && <ErrorNote message={error} onRetry={reload} />}
          {loading && !data && <ListSkeleton rows={5} h="h-28" />}
          {data && data.length === 0 && (
            <Empty emoji="🗓️" title="Nothing on yet" body={hobby || q ? 'Nothing matches those filters. Try another day or hobby.' : 'Be the first: host something and people nearby who share the hobby will hear about it.'}
              action={<Link to="/host" className="btn btn-primary">Host an activity</Link>} />
          )}
          {groups.map(g => (
            <section key={g.label}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-extrabold">
                {g.label}<span className="h-0.5 flex-1 bg-ink/15" /><span className="font-mono text-xs text-ink-soft">{g.items.length}</span>
              </h2>
              <div className="space-y-3">
                {g.items.map((a, i) => <ActivityCard key={a.id} a={a} i={i} />)}
              </div>
            </section>
          ))}
        </div>
      )}
      <Fab to="/host" label="Host" />
    </main>
  )
}
