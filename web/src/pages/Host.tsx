import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Level } from '../api/client'
import { useAuth, useRefData } from '../state/auth'
import { PinPicker, SEATTLE } from '../components/MapView'
import { HobbyChip, PageHeader, Segmented, Toggle, toast } from '../components/ui'
import { toLocalInput } from '../lib/format'

function defaultStart() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  d.setHours(18, 30, 0, 0)
  return d
}

const LEVEL_OPTS: { value: Level; label: string }[] = [
  { value: 'any', label: 'All' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Mid' }, { value: 'advanced', label: 'Advanced' },
]

export default function Host() {
  const { me } = useAuth()
  const { hobbies, hobbyMap, neighborhoods } = useRefData()
  const nav = useNavigate()

  const home = neighborhoods.find(n => n.name === me?.neighborhood)
  const [hobbyId, setHobbyId] = useState<string>(me?.hobbies?.[0]?.hobby_id ?? '')
  const [hobbyQ, setHobbyQ] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState(toLocalInput(defaultStart()))
  const [duration, setDuration] = useState(120)
  const [venue, setVenue] = useState('')
  const [hood, setHood] = useState(me?.neighborhood ?? '')
  const [pos, setPos] = useState<[number, number]>(home ? [home.lat, home.lng] : [me?.lat ?? SEATTLE[0], me?.lng ?? SEATTLE[1]])
  const [privacy, setPrivacy] = useState<'exact' | 'area'>('exact')
  const [capacity, setCapacity] = useState('')
  const [cost, setCost] = useState('')
  const [level, setLevel] = useState<Level>('any')
  const [approval, setApproval] = useState(false)
  const [weekly, setWeekly] = useState(false)
  const [busy, setBusy] = useState(false)

  const hobbyOptions = useMemo(() => {
    const s = hobbyQ.trim().toLowerCase()
    if (s) return hobbies.filter(h => h.name.toLowerCase().includes(s)).slice(0, 16).map(h => h.id)
    const mine = (me?.hobbies ?? []).map(h => h.hobby_id)
    return mine.length ? mine : hobbies.slice(0, 12).map(h => h.id)
  }, [hobbyQ, hobbies, me])

  const h = hobbyMap[hobbyId]
  const placeholder = h ? `${h.name} at ${venue || 'the park'}` : 'Board game night at Mox'

  function pickHood(name: string) {
    setHood(name)
    const n = neighborhoods.find(x => x.name === name)
    if (n) setPos([n.lat, n.lng])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!hobbyId) { toast('Pick a hobby first'); return }
    const s = new Date(start)
    if (s.getTime() < Date.now()) { toast('Pick a time in the future'); return }
    setBusy(true)
    try {
      const created = await api.createActivity({
        hobby_id: hobbyId,
        title: title.trim() || placeholder,
        description: description.trim(),
        starts_at: s.toISOString(),
        ends_at: new Date(s.getTime() + duration * 60e3).toISOString(),
        venue_name: venue.trim(),
        neighborhood: hood,
        lat: pos[0], lng: pos[1],
        location_privacy: privacy,
        capacity: capacity ? Number(capacity) : null,
        cost_cents: cost ? Math.round(Number(cost) * 100) : 0,
        level,
        requires_approval: privacy === 'area' ? true : approval,
        recurring_weekly: weekly,
      })
      toast('Activity posted. People nearby who share the hobby will see it')
      nav(`/activities/${created.id}`, { replace: true })
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not post it') } finally { setBusy(false) }
  }

  return (
    <main className="pb-28">
      <PageHeader title="Host something" back />
      <form id="host-form" onSubmit={submit} className="space-y-6 px-4 py-5">
        <Field label="What's the hobby?">
          <input className="input mb-2 py-2 text-sm" placeholder="Search hobbies" value={hobbyQ} onChange={e => setHobbyQ(e.target.value)} aria-label="Search hobbies" />
          <div className="flex flex-wrap gap-2">
            {hobbyOptions.map(id => <HobbyChip key={id} id={id} active={hobbyId === id} onClick={() => setHobbyId(id)} />)}
          </div>
        </Field>

        <Field label="Title">
          <input className="input" placeholder={placeholder} value={title} onChange={e => setTitle(e.target.value)} maxLength={80} />
        </Field>

        <Field label="Details" hint="What to bring, what it costs, what level it's for.">
          <textarea className="input resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Bring a game if you have one. Beginners welcome, we'll teach." />
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Starts">
            <input className="input" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required />
          </Field>
          <Field label="Length">
            <select className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {[60, 90, 120, 180, 240].map(m => <option key={m} value={m}>{m / 60} h</option>)}
            </select>
          </Field>
        </div>
        <Toggle checked={weekly} onChange={setWeekly} label="Repeats every week" hint="People join once and go every week unless they skip." />

        <Field label="Where?">
          <input className="input mb-2" placeholder="Venue or meeting spot (e.g. Gas Works Park, north lawn)" value={venue} onChange={e => setVenue(e.target.value)} />
          <select className="input mb-2" value={hood} onChange={e => pickHood(e.target.value)} aria-label="Neighborhood">
            <option value="">Neighborhood</option>
            {neighborhoods.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
          </select>
          <div className="sticker overflow-hidden">
            <PinPicker lat={pos[0]} lng={pos[1]} onChange={(la, ln) => setPos([la, ln])} emoji={h?.emoji} className="h-52" />
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">Tap the map or drag the pin to your meeting spot.</p>
          <div className="mt-3">
            <Segmented value={privacy} onChange={setPrivacy} options={[{ value: 'exact', label: 'Exact spot' }, { value: 'area', label: 'General area' }]} />
            <p className="mt-1.5 text-xs text-ink-soft">
              {privacy === 'exact' ? 'Pick a public place. Hosting at home? Use General area.' : 'Everyone sees the area; only people you approve see the exact spot.'}
            </p>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Spots" hint="Empty = no limit">
            <input className="input" inputMode="numeric" placeholder="∞" value={capacity} onChange={e => setCapacity(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Cost ($)" hint="Empty = free">
            <input className="input" inputMode="decimal" placeholder="Free" value={cost} onChange={e => setCost(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
        </div>

        <Field label="Level">
          <Segmented value={level} onChange={setLevel} options={LEVEL_OPTS} />
        </Field>

        {privacy === 'exact' && <Toggle checked={approval} onChange={setApproval} label="Approve people before they join" hint="Good for small or home-hosted groups." />}
      </form>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t-2 border-ink bg-paper px-4 py-3">
        <button form="host-form" className="btn btn-primary w-full py-3.5" disabled={busy || !hobbyId}>{busy ? 'Posting…' : 'Post activity'}</button>
      </div>
    </main>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-display font-bold">{label}</span>
        {hint && <span className="text-xs text-ink-soft">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
