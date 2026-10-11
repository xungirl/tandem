import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { api, useApi } from '../api/client'
import type { AvailabilitySlot, UserHobby } from '../api/client'
import { useAuth } from '../state/auth'
import { AvailabilityGrid, HobbyPicker } from '../components/Pickers'
import { PersonRow } from '../components/People'
import { ActivityMiniCard } from '../components/ActivityCard'
import { Avatar, BadgeTile, HobbyChip, PageHeader, Toggle, toast } from '../components/ui'

export default function MePage() {
  const { me, refreshMe, setMe, signOut } = useAuth()
  const badges = useApi(() => api.badges(), [])
  const friends = useApi(() => api.friends(), [])
  const past = useApi(() => api.activities({ mine: 'past' }), [])
  const [editing, setEditing] = useState<null | 'profile' | 'hobbies' | 'times'>(null)
  const [code, setCode] = useState('')

  if (!me) return null
  const age = me.birth_year ? new Date().getFullYear() - me.birth_year : null
  const display = `${me.first_name} ${me.last_name?.[0] ?? ''}.`

  async function toggleOpen(v: boolean) {
    setMe({ ...me!, open_to_plans: v })
    try { await api.updateMe({ open_to_plans: v }); toast(v ? 'Open to plans: we can suggest groups for you' : 'Group suggestions are off') } catch { refreshMe() }
  }

  async function addByCode(e: FormEvent) {
    e.preventDefault()
    try { await api.addByCode(code.trim().toUpperCase()); toast('Added. You are friends now'); setCode(''); friends.reload() }
    catch (err) { toast(err instanceof Error ? err.message : 'No one has that code') }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(me!.friend_code); toast('Copied. Paste it into a text') } catch { toast(me!.friend_code) }
  }

  const stats = me.stats ?? {}
  const incoming = friends.data?.incoming ?? []

  return (
    <main>
      <PageHeader title="Me" right={<Link to={`/people/${me.id}`} className="btn btn-ghost btn-sm">See it as people do</Link>} />

      <section className="flex items-center gap-4 px-4 pt-5">
        <Avatar user={{ avatar: me.avatar, display_name: display }} size={80} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl leading-none font-extrabold">{display}</h2>
          <p className="mt-1 text-sm font-semibold text-ink-soft">{[age, me.neighborhood].filter(Boolean).join(' · ')}</p>
          <button type="button" className="mt-1 text-sm font-semibold underline" onClick={() => setEditing('profile')}>Edit profile</button>
        </div>
      </section>

      {Object.keys(stats).length > 0 && (
        <section className="mx-4 mt-4 grid grid-cols-3 divide-x-2 divide-ink overflow-hidden rounded-2xl border-2 border-ink bg-white text-center shadow-[3px_3px_0_#1F1A17]">
          {Object.entries(stats).slice(0, 3).map(([k, v]) => (
            <div key={k} className="py-3">
              <div className="font-display text-2xl font-extrabold">{v}</div>
              <div className="text-[11px] font-bold text-ink-soft capitalize">{k.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </section>
      )}

      <div className="space-y-7 px-4 py-6">
        {incoming.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-lg font-extrabold">Friend requests ({incoming.length})</h3>
            <div className="space-y-3">{incoming.map(p => <PersonRow key={p.id} p={p} />)}</div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-display text-lg font-extrabold">Hobbies</h3>
            <button type="button" className="text-sm font-semibold underline" onClick={() => setEditing('hobbies')}>Add or edit</button>
          </div>
          <div className="flex flex-wrap gap-2">{(me.hobbies ?? []).map(h => <HobbyChip key={h.hobby_id} id={h.hobby_id} level={h.level} active />)}</div>
        </section>

        <section className="sticker p-4">
          <Toggle checked={me.open_to_plans} onChange={toggleOpen} label="Open to plans"
            hint="We can suggest small groups for your hobbies, and hosts can invite you." />
          <div className="mt-1 flex items-center justify-between border-t-2 border-ink/10 pt-3">
            <div>
              <div className="font-semibold">When you're free</div>
              <div className="text-xs text-ink-soft">{(me.availability ?? []).length} time slots a week · only you see this</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing('times')}>Edit</button>
          </div>
          <div className="mt-3 flex items-center justify-between border-t-2 border-ink/10 pt-3">
            <div>
              <div className="font-semibold">Vibe Check</div>
              <div className="text-xs text-ink-soft">{me.vibe_summary?.length ? me.vibe_summary.join(' · ') : me.vibe && Object.keys(me.vibe).length ? 'Done. Retake it any time.' : 'Answer a few scenarios to sharpen your matches.'}</div>
            </div>
            <Link to="/vibe" className="btn btn-ghost btn-sm">{me.vibe && Object.keys(me.vibe).length ? 'Retake' : 'Take it'}</Link>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-display text-lg font-extrabold">Badges</h3>
          {badges.data && badges.data.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">{badges.data.map(b => <BadgeTile key={b.hobby_id + b.tier} badge={b} />)}</div>
          ) : (
            <div className="sticker border-dashed bg-white p-4 text-sm text-ink-soft">Check in at your first activity to earn a Bronze badge. Bronze → Silver → Gold → Platinum → Legendary.</div>
          )}
        </section>

        {past.data && past.data.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-lg font-extrabold">Been there <span className="font-mono text-sm text-ink-soft">{past.data.length}</span></h3>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">{past.data.map(a => <ActivityMiniCard key={a.id} a={a} />)}</div>
          </section>
        )}

        <section className="sticker bg-teal-soft p-4">
          <h3 className="font-display text-lg font-extrabold">Your friend code</h3>
          <p className="text-sm text-ink-soft">Give it to someone you met. They type it in and you're friends right away.</p>
          <button type="button" onClick={copyCode} className="mt-3 w-full rounded-xl border-2 border-dashed border-ink bg-white py-3 font-mono text-3xl font-bold tracking-[0.35em]" aria-label="Copy friend code">
            {me.friend_code}
          </button>
          <form onSubmit={addByCode} className="mt-3 flex gap-2">
            <input className="input flex-1 font-mono uppercase" placeholder="Their code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} aria-label="Their friend code" />
            <button className="btn btn-dark" disabled={code.trim().length < 4}>Add</button>
          </form>
        </section>

        <section>
          <h3 className="mb-2 font-display text-lg font-extrabold">Friends {friends.data ? <span className="font-mono text-sm text-ink-soft">{friends.data.friends.length}</span> : null}</h3>
          <div className="space-y-3">
            {friends.data?.friends.map(p => <PersonRow key={p.id} p={p} />)}
            {friends.data?.friends.length === 0 && <p className="text-sm text-ink-soft">Add anyone you got along with. They get a friend request saying you met here.</p>}
          </div>
        </section>

        <button type="button" className="btn btn-ghost w-full" onClick={signOut}>Sign out</button>
      </div>

      {editing === 'profile' && <EditProfile onClose={() => setEditing(null)} />}
      {editing === 'hobbies' && <EditHobbies onClose={() => setEditing(null)} />}
      {editing === 'times' && <EditTimes onClose={() => setEditing(null)} />}
    </main>
  )
}

function Sheet({ title, onClose, onSave, busy, children }: { title: string; onClose: () => void; onSave: () => void; busy: boolean; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-t-3xl border-2 border-ink bg-paper animate-rise" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4">
          <h2 className="font-display text-xl font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="border-t-2 border-ink p-4"><button type="button" className="btn btn-primary w-full" onClick={onSave} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </div>
    </div>
  )
}

function useSaver(onClose: () => void) {
  const { refreshMe } = useAuth()
  const [busy, setBusy] = useState(false)
  return {
    busy,
    save: async (fn: () => Promise<unknown>) => {
      setBusy(true)
      try { await fn(); await refreshMe(); toast('Saved'); onClose() } catch (e) { toast(e instanceof Error ? e.message : 'Could not save') } finally { setBusy(false) }
    },
  }
}

function EditProfile({ onClose }: { onClose: () => void }) {
  const { me } = useAuth()
  const { busy, save } = useSaver(onClose)
  const [bio, setBio] = useState(me?.bio ?? '')
  const [langs, setLangs] = useState((me?.languages ?? []).join(', '))
  const [ig, setIg] = useState(me?.instagram ?? '')
  return (
    <Sheet title="Edit profile" onClose={onClose} busy={busy} onSave={() => save(() => api.updateMe({
      bio: bio.trim(), instagram: ig.trim().replace(/^@/, '') || null, languages: langs.split(',').map(s => s.trim()).filter(Boolean),
    }))}>
      <div className="space-y-4">
        <label className="block"><span className="mb-1 block font-semibold">About (optional)</span>
          <textarea className="input resize-none" rows={3} maxLength={240} value={bio} onChange={e => setBio(e.target.value)} placeholder="New to Seattle, always up for a climb and a coffee after." /></label>
        <p className="-mt-2 text-xs text-ink-soft">Keep your address, phone number and workplace out of your bio.</p>
        <label className="block"><span className="mb-1 block font-semibold">Languages you speak</span>
          <input className="input" value={langs} onChange={e => setLangs(e.target.value)} placeholder="English, Mandarin" /></label>
        <label className="block"><span className="mb-1 block font-semibold">Instagram (optional)</span>
          <input className="input" value={ig} onChange={e => setIg(e.target.value)} placeholder="@handle" /></label>
        <p className="-mt-2 text-xs text-ink-soft">Only friends see your Instagram.</p>
      </div>
    </Sheet>
  )
}

function EditHobbies({ onClose }: { onClose: () => void }) {
  const { me } = useAuth()
  const { busy, save } = useSaver(onClose)
  const [h, setH] = useState<UserHobby[]>(me?.hobbies ?? [])
  return (
    <Sheet title="Your hobbies" onClose={onClose} busy={busy || h.length === 0} onSave={() => save(() => api.setHobbies(h))}>
      <HobbyPicker value={h} onChange={setH} />
      {h.length === 0 && <p className="mt-3 text-sm font-semibold text-coral">Keep at least one hobby.</p>}
    </Sheet>
  )
}

function EditTimes({ onClose }: { onClose: () => void }) {
  const { me } = useAuth()
  const { busy, save } = useSaver(onClose)
  const [a, setA] = useState<AvailabilitySlot[]>(me?.availability ?? [])
  return (
    <Sheet title="When you're usually free" onClose={onClose} busy={busy} onSave={() => save(() => api.setAvailability(a))}>
      <AvailabilityGrid value={a} onChange={setA} />
    </Sheet>
  )
}
