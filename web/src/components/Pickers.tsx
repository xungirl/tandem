import { useMemo, useState } from 'react'
import { api } from '../api/client'
import type { AvailabilitySlot, UserHobby } from '../api/client'
import { useRefData } from '../state/auth'
import { LEVELS, SLOTS, SLOT_LABEL, WEEKDAYS } from '../lib/format'
import { HobbyChip, HobbyEmoji, toast } from './ui'

/** Search + chips + "speak your hobbies" free text, with a level per hobby. */
export function HobbyPicker({ value, onChange }: { value: UserHobby[]; onChange: (v: UserHobby[]) => void }) {
  const { hobbies, hobbyMap, addHobby } = useRefData()
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const selected = new Set(value.map(v => v.hobby_id))

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pool = s ? hobbies.filter(h => h.name.toLowerCase().includes(s) || h.category.toLowerCase().includes(s)) : hobbies
    return pool.slice(0, s ? 30 : 24)
  }, [q, hobbies])

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(value.filter(v => v.hobby_id !== id))
    else onChange([...value, { hobby_id: id, level: 2, open_to_plans: true }])
  }
  const setLevel = (id: string, level: number) => onChange(value.map(v => (v.hobby_id === id ? { ...v, level } : v)))

  async function parse() {
    if (!text.trim()) return
    setParsing(true)
    try {
      const r = await api.parseHobbies(text)
      const merged = [...value]
      let added = 0
      for (const h of r.hobbies) if (!merged.some(m => m.hobby_id === h.hobby_id)) { merged.push({ open_to_plans: true, ...h }); added++ }
      onChange(merged)
      toast(added ? `Added ${added} hobb${added === 1 ? 'y' : 'ies'}${r.used_ai ? ' with AI' : ''}` : 'No new hobbies found in that')
      setText('')
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not read that') } finally { setParsing(false) }
  }

  async function addCustom() {
    const name = q.trim()
    if (!name) return
    try {
      const h = await api.addHobby(name)
      addHobby(h)
      if (!selected.has(h.id)) onChange([...value, { hobby_id: h.id, level: 2, open_to_plans: true }])
      setQ('')
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not add that hobby') }
  }

  const exact = hobbies.some(h => h.name.toLowerCase() === q.trim().toLowerCase())

  return (
    <div className="space-y-5">
      <div className="sticker bg-sun-soft p-3">
        <label htmlFor="speak" className="flex items-center gap-2 font-display font-bold">🎙️ Say it how you'd say it</label>
        <textarea id="speak" rows={2} className="input mt-2 resize-none text-sm" value={text} onChange={e => setText(e.target.value)}
          placeholder="I boulder twice a week, I'm learning pottery and I'll never say no to Catan" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-ink-soft">Tap the mic on your keyboard to talk, or type.</span>
          <button type="button" className="btn btn-dark btn-sm" onClick={parse} disabled={parsing || !text.trim()}>{parsing ? 'Reading…' : 'Find hobbies'}</button>
        </div>
      </div>

      <div>
        <input className="input" placeholder="Search, or type your own hobby" value={q} onChange={e => setQ(e.target.value)} aria-label="Search hobbies" />
        <div className="mt-3 flex flex-wrap gap-2">
          {matches.map(h => <HobbyChip key={h.id} id={h.id} active={selected.has(h.id)} onClick={() => toggle(h.id)} />)}
          {q.trim() && !exact && (
            <button type="button" className="rounded-full border-2 border-dashed border-ink bg-white px-3 py-1 text-sm font-semibold" onClick={addCustom}>
              + Add “{q.trim()}”
            </button>
          )}
        </div>
      </div>

      {value.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-lg font-bold">How into it are you?</h3>
          <ul className="space-y-2">
            {value.map(v => (
              <li key={v.hobby_id} className="sticker flex items-center gap-3 p-2.5">
                <HobbyEmoji id={v.hobby_id} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{hobbyMap[v.hobby_id]?.name ?? v.hobby_id}</div>
                  <div className="text-xs text-ink-soft">{LEVELS[v.level]}</div>
                </div>
                <div className="flex gap-1" role="radiogroup" aria-label="Level">
                  {[1, 2, 3, 4].map(l => (
                    <button key={l} type="button" role="radio" aria-checked={v.level === l} aria-label={LEVELS[l]} onClick={() => setLevel(v.hobby_id, l)}
                      className={`h-7 w-7 rounded-full border-2 border-ink text-xs font-bold transition ${v.level >= l ? 'bg-coral' : 'bg-white'}`}>{l}</button>
                  ))}
                </div>
                <button type="button" className="px-1 text-lg text-ink-soft" onClick={() => toggle(v.hobby_id)} aria-label="Remove">×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 7 × 3 grid of weekly free times. Drag-free: tap cells, or tap a row/column label. */
export function AvailabilityGrid({ value, onChange }: { value: AvailabilitySlot[]; onChange: (v: AvailabilitySlot[]) => void }) {
  const has = (d: number, s: string) => value.some(v => v.weekday === d && v.slot === s)
  const toggle = (d: number, s: AvailabilitySlot['slot']) =>
    onChange(has(d, s) ? value.filter(v => !(v.weekday === d && v.slot === s)) : [...value, { weekday: d, slot: s }])
  const toggleDay = (d: number) => {
    const all = SLOTS.every(s => has(d, s))
    const rest = value.filter(v => v.weekday !== d)
    onChange(all ? rest : [...rest, ...SLOTS.map(s => ({ weekday: d, slot: s }))])
  }
  return (
    <div className="sticker overflow-hidden">
      <div className="grid grid-cols-[64px_repeat(3,1fr)] border-b-2 border-ink bg-paper text-center text-xs font-bold">
        <div />
        {SLOTS.map(s => <div key={s} className="py-2">{SLOT_LABEL[s]}</div>)}
      </div>
      {WEEKDAYS.map((d, i) => (
        <div key={d} className="grid grid-cols-[64px_repeat(3,1fr)] border-b border-ink/15 last:border-0">
          <button type="button" onClick={() => toggleDay(i)} className="py-2.5 text-left pl-3 font-mono text-xs font-bold">{d.toUpperCase()}</button>
          {SLOTS.map(s => {
            const on = has(i, s)
            return (
              <button key={s} type="button" aria-pressed={on} aria-label={`${d} ${s}`} onClick={() => toggle(i, s)}
                className="grid place-items-center p-1.5">
                <span className={`block h-8 w-full rounded-lg border-2 transition ${on ? 'border-ink bg-teal shadow-[2px_2px_0_#1F1A17]' : 'border-ink/20 bg-paper'}`} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
