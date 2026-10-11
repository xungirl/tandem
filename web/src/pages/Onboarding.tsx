import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { AvailabilitySlot, UserHobby } from '../api/client'
import { useAuth, useRefData } from '../state/auth'
import { AvailabilityGrid, HobbyPicker } from '../components/Pickers'
import { Logo } from '../components/Logo'
import { toast } from '../components/ui'

const STEPS = ['You', 'Neighborhood', 'Hobbies', 'Free time', 'Done'] as const
const AVATARS = ['🦊', '🐻', '🐸', '🦉', '🐙', '🦦', '🐝', '🌵', '🍄', '🌻']
const AVATAR_COLORS = ['#FFC94A', '#FF6B4A', '#1FA59A', '#B9A6FF', '#FF9CC2', '#8EC5FF']

export default function Onboarding() {
  const { me, refreshMe } = useAuth()
  const { neighborhoods, hobbyMap } = useRefData()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [first, setFirst] = useState(me?.first_name ?? '')
  const [last, setLast] = useState(me?.last_name ?? '')
  const [birthYear, setBirthYear] = useState<string>(me?.birth_year ? String(me.birth_year) : '')
  const [avatar, setAvatar] = useState(me?.avatar || `${AVATARS[0]}|${AVATAR_COLORS[0]}`)
  const [hood, setHood] = useState(me?.neighborhood ?? '')
  const [hoodQ, setHoodQ] = useState('')
  const [hobbies, setHobbies] = useState<UserHobby[]>(me?.hobbies ?? [])
  const [avail, setAvail] = useState<AvailabilitySlot[]>(me?.availability ?? [])

  useEffect(() => { window.scrollTo(0, 0) }, [step])

  const age = birthYear ? new Date().getFullYear() - Number(birthYear) : null
  const canNext = [
    first.trim().length > 0 && last.trim().length > 0 && age !== null && age >= 18 && age < 100,
    !!hood,
    hobbies.length > 0,
    true,
    true,
  ][step]

  const hoods = useMemo(() => {
    const s = hoodQ.trim().toLowerCase()
    return neighborhoods.filter(n => !s || n.name.toLowerCase().includes(s))
  }, [hoodQ, neighborhoods])

  async function next() {
    setBusy(true)
    try {
      if (step === 0) await api.updateMe({ first_name: first.trim(), last_name: last.trim(), birth_year: Number(birthYear), avatar })
      if (step === 1) await api.updateMe({ neighborhood: hood })
      if (step === 2) await api.setHobbies(hobbies)
      if (step === 3) { await api.setAvailability(avail); await refreshMe() }
      setStep(s => s + 1)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save that')
    } finally { setBusy(false) }
  }

  const [emoji, color] = avatar.split('|')

  return (
    <main className="flex min-h-dvh flex-col">
      {step < 4 && (
        <header className="sticky top-0 z-10 border-b-2 border-ink bg-paper px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s - 1)} className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-white" aria-label="Back">‹</button>
            )}
            <span className="font-mono text-xs font-bold tracking-wider">STEP {step + 1} OF 4</span>
          </div>
          {/* Step track */}
          <ol className="mt-3 flex items-center gap-1.5" aria-label="Progress">
            {STEPS.slice(0, 4).map((s, i) => (
              <li key={s} className="flex flex-1 flex-col gap-1">
                <span className={`h-2 rounded-full border-2 border-ink transition-colors ${i < step ? 'bg-teal' : i === step ? 'bg-coral' : 'bg-white'}`} />
                <span className={`text-[10px] font-bold ${i <= step ? 'text-ink' : 'text-ink-soft/60'}`}>{s}</span>
              </li>
            ))}
          </ol>
        </header>
      )}

      <div key={step} className="flex-1 px-5 py-6 animate-rise">
        {step === 0 && (
          <div className="space-y-5">
            <h1 className="font-display text-3xl leading-tight font-extrabold">First, who's joining?</h1>
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-ink text-4xl shadow-[3px_3px_0_#1F1A17]" style={{ background: color }}>{emoji}</div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.map(a => (
                    <button key={a} type="button" onClick={() => setAvatar(`${a}|${color}`)} aria-label={`Avatar ${a}`}
                      className={`grid h-8 w-8 place-items-center rounded-full border-2 text-lg ${a === emoji ? 'border-ink bg-white' : 'border-transparent'}`}>{a}</button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setAvatar(`${emoji}|${c}`)} aria-label={`Color ${c}`}
                      className={`h-6 w-6 rounded-full border-2 border-ink ${c === color ? 'ring-2 ring-ink ring-offset-2' : ''}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-sm font-semibold">First name</span>
                <input className="input" value={first} onChange={e => setFirst(e.target.value)} autoComplete="given-name" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold">Last name</span>
                <input className="input" value={last} onChange={e => setLast(e.target.value)} autoComplete="family-name" /></label>
            </div>
            <p className="-mt-2 text-xs text-ink-soft">Members see your first name and last initial{first && last ? `: ${first.trim()} ${last.trim()[0]?.toUpperCase()}.` : '.'}</p>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Year you were born</span>
              <input className="input" inputMode="numeric" maxLength={4} placeholder="1998" value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, ''))} /></label>
            <p className="-mt-2 text-xs text-ink-soft">{age !== null && birthYear.length === 4 && age < 18 ? 'Tandem is for people 18 and older.' : 'Members see your age, never the date.'}</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-display text-3xl leading-tight font-extrabold">Where in Seattle do you live?</h1>
            <p className="text-ink-soft">We use your neighborhood to show what's close. Your exact location is never shared.</p>
            <input className="input" placeholder="Search neighborhoods" value={hoodQ} onChange={e => setHoodQ(e.target.value)} aria-label="Search neighborhoods" />
            <div className="flex flex-wrap gap-2">
              {hoods.map(n => (
                <button key={n.name} type="button" onClick={() => setHood(n.name)} aria-pressed={hood === n.name}
                  className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm font-semibold transition ${hood === n.name ? 'bg-teal shadow-[2px_2px_0_#1F1A17]' : 'bg-white'}`}>{n.name}</button>
              ))}
              {hoods.length === 0 && <p className="text-sm text-ink-soft">No neighborhood by that name. Try a nearby one.</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="font-display text-3xl leading-tight font-extrabold">What are you into?</h1>
            <p className="text-ink-soft">Pick at least one. Be honest about levels: your Friend Score is only useful if it's true.</p>
            <HobbyPicker value={hobbies} onChange={setHobbies} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="font-display text-3xl leading-tight font-extrabold">When are you usually free?</h1>
            <p className="text-ink-soft">Only you see this. We use it to suggest small groups at times that work for everyone.</p>
            <AvailabilityGrid value={avail} onChange={setAvail} />
          </div>
        )}

        {step === 4 && (
          <div className="flex min-h-[80dvh] flex-col items-center justify-center text-center">
            <div className="relative grid h-72 w-72 place-items-center" aria-hidden>
              {hobbies.slice(0, 8).map((h, i, arr) => {
                const angle = (i / arr.length) * Math.PI * 2
                return (
                  <span key={h.hobby_id} className="absolute grid h-12 w-12 place-items-center rounded-full border-2 border-ink bg-white text-2xl shadow-[2px_2px_0_#1F1A17] animate-pop"
                    style={{ transform: `translate(${Math.cos(angle) * 115}px, ${Math.sin(angle) * 115}px)`, animationDelay: `${200 + i * 120}ms` }}>
                    {hobbyMap[h.hobby_id]?.emoji ?? '✨'}
                  </span>
                )
              })}
              <div className="animate-pop" style={{ animationDelay: '100ms' }}><Logo size={130} /></div>
            </div>
            <h1 className="mt-4 font-display text-4xl font-extrabold">You're in, {first || me?.first_name}.</h1>
            <p className="mt-2 max-w-xs text-ink-soft">Your hobbies are on the map. Next: find something to do this week, or take the Vibe Check so your matches get sharper.</p>
            <div className="mt-6 flex w-full flex-col gap-3">
              <button type="button" className="btn btn-primary py-3.5" onClick={() => nav('/')}>Find something to do</button>
              <button type="button" className="btn btn-ghost py-3.5" onClick={() => nav('/vibe')}>Take the Vibe Check (2 min)</button>
            </div>
          </div>
        )}
      </div>

      {step < 4 && (
        <footer className="sticky bottom-0 border-t-2 border-ink bg-paper px-5 py-4">
          <button type="button" className="btn btn-primary w-full py-3.5" onClick={next} disabled={!canNext || busy}>
            {busy ? 'Saving…' : step === 3 ? (avail.length ? 'Finish' : 'Skip for now') : 'Continue'}
          </button>
        </footer>
      )}
    </main>
  )
}
