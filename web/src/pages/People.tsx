import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, useApi } from '../api/client'
import type { GroupSuggestion } from '../api/client'
import { useAuth } from '../state/auth'
import { PersonRow, SuggestionCard } from '../components/People'
import { Empty, ErrorNote, HobbyChip, ListSkeleton, PageHeader, Skeleton, toast } from '../components/ui'

const DISTANCES = [{ v: 0, l: 'Anywhere' }, { v: 3, l: '< 3 km' }, { v: 8, l: '< 8 km' }]

export default function People() {
  const { me } = useAuth()
  const nav = useNavigate()
  const [hobby, setHobby] = useState<string | null>(null)
  const [km, setKm] = useState(0)
  const [ageBand, setAgeBand] = useState(false)
  const age = me?.birth_year ? new Date().getFullYear() - me.birth_year : null

  const people = useApi(() => api.people({
    hobby: hobby ?? undefined,
    max_km: km || undefined,
    age_min: ageBand && age ? age - 5 : undefined,
    age_max: ageBand && age ? age + 5 : undefined,
  }), [hobby, km, ageBand])
  const sugg = useApi(() => api.suggestions(), [])
  const [accepting, setAccepting] = useState<string | null>(null)

  async function accept(s: GroupSuggestion) {
    const key = `${s.hobby_id}-${s.weekday}-${s.slot}`
    setAccepting(key)
    try {
      const r = await api.acceptSuggestion({ hobby_id: s.hobby_id, weekday: s.weekday, slot: s.slot, member_ids: s.members.map(m => m.id) })
      toast('Group chat started. Say hi and settle the details')
      nav(`/chats/${r.chat_id}`)
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not start the group') } finally { setAccepting(null) }
  }

  return (
    <main>
      <PageHeader title="People" sub={
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {DISTANCES.map(d => (
            <button key={d.v} type="button" aria-pressed={km === d.v} onClick={() => setKm(d.v)}
              className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${km === d.v ? 'bg-ink text-paper' : 'bg-white'}`}>{d.l}</button>
          ))}
          {age && (
            <button type="button" aria-pressed={ageBand} onClick={() => setAgeBand(!ageBand)}
              className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${ageBand ? 'bg-ink text-paper' : 'bg-white'}`}>{age - 5}–{age + 5}</button>
          )}
          <span className="mx-1 w-0.5 shrink-0 bg-ink/20" />
          {(me?.hobbies ?? []).map(h => (
            <HobbyChip key={h.hobby_id} id={h.hobby_id} active={hobby === h.hobby_id} onClick={() => setHobby(hobby === h.hobby_id ? null : h.hobby_id)} />
          ))}
        </div>
      } />

      <section className="pt-4">
        <div className="flex items-baseline justify-between px-4">
          <h2 className="font-display text-lg font-extrabold">Groups we'd put together</h2>
          {!me?.open_to_plans && <span className="text-xs font-semibold text-ink-soft">Turn on “Open to plans” in Me</span>}
        </div>
        <p className="px-4 text-sm text-ink-soft">Same hobby, close by, free at the same time.</p>
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-3">
          {sugg.loading && !sugg.data && [0, 1].map(i => <Skeleton key={i} className="h-56 w-[280px] shrink-0" />)}
          {sugg.data?.map(s => {
            const key = `${s.hobby_id}-${s.weekday}-${s.slot}`
            return <SuggestionCard key={key} s={s} busy={accepting === key} onAccept={() => accept(s)} />
          })}
          {sugg.data && sugg.data.length === 0 && (
            <div className="sticker w-full border-dashed bg-white p-4 text-sm text-ink-soft">
              No groups yet. Add free times and turn on “Open to plans” for a hobby, and we'll suggest small groups here.
            </div>
          )}
          {sugg.error && <div className="text-sm text-ink-soft">Suggestions are unavailable right now.</div>}
        </div>
      </section>

      <section className="space-y-3 px-4 pt-2 pb-6">
        <h2 className="font-display text-lg font-extrabold">Ranked by Friend Score</h2>
        {people.error && <ErrorNote message={people.error} onRetry={people.reload} />}
        {people.loading && !people.data && <ListSkeleton rows={6} h="h-28" />}
        {people.data?.length === 0 && <Empty emoji="🔭" title="Nobody fits these filters" body="Widen the distance or pick a different hobby." />}
        {people.data?.map((p, i) => <PersonRow key={p.id} p={p} i={i} />)}
      </section>
    </main>
  )
}
