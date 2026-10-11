import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api } from '../api/client'
import { useAuth } from '../state/auth'
import { Logo } from '../components/Logo'

const ORBIT = ['🧗', '♟️', '🏺', '🎲', '🏃', '🎸', '🧶', '🏓', '📚', '🛶', '🍳', '📷']

const PROMISES = [
  { emoji: '🗺️', title: 'Real plans on a map', body: 'Board game nights, run clubs, pottery drop-ins. Hosted by neighbors and local spots.' },
  { emoji: '🎯', title: 'A Friend Score you can read', body: 'See exactly why you and someone click: rare hobbies you share, free time that lines up, how close you live.' },
  { emoji: '🧩', title: 'Groups that form themselves', body: "Free Thursday evenings and into bouldering? We'll find three others who are too." },
]

export default function Welcome() {
  const { token, signIn } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'start' | 'email' | 'code'>('start')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (token) return <Navigate to="/" replace />

  async function demo() {
    setBusy(true); setErr(null)
    try {
      const r = await api.demo()
      await signIn(r.token, r.user)
      nav('/')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Demo sign-in failed') } finally { setBusy(false) }
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await api.requestCode(email.trim())
      setDevCode(r.dev_code ?? null)
      if (r.dev_code) setCode(r.dev_code)
      setMode('code')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send the code') } finally { setBusy(false) }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await api.verify(email.trim(), code.trim())
      await signIn(r.token, r.user)
      nav(r.is_new ? '/onboarding' : '/')
    } catch (e) { setErr(e instanceof Error ? e.message : 'That code did not work') } finally { setBusy(false) }
  }

  return (
    <main className="min-h-dvh overflow-hidden">
      <section className="relative px-6 pt-10 pb-6">
        <div className="flex items-center gap-2">
          <Logo size={34} />
          <span className="font-display text-xl font-extrabold tracking-tight">Tandem</span>
          <span className="ml-auto rounded-full border-2 border-ink bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold">SEATTLE</span>
        </div>

        {/* Signature: hobbies orbiting the two-ring mark */}
        <div className="relative mx-auto mt-8 grid h-64 w-64 place-items-center" aria-hidden>
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-ink/30" />
          {ORBIT.map((e, i) => (
            <span key={e} className="absolute top-1/2 left-1/2 -mt-5 -ml-5 grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white text-xl shadow-[2px_2px_0_#1F1A17]"
              style={{ ['--r' as string]: '112px', animation: `orbit 38s linear infinite`, animationDelay: `${(-38 / ORBIT.length) * i}s` }}>
              {e}
            </span>
          ))}
          <div className="animate-pop"><Logo size={120} /></div>
        </div>

        <h1 className="mt-6 font-display text-[44px] leading-[0.95] font-extrabold tracking-tight">
          Find your people<br />by doing <span className="relative inline-block"><span className="relative z-10">your thing</span><span className="absolute inset-x-0 bottom-1 -z-0 h-4 -rotate-1 bg-sun" /></span>.
        </h1>
        <p className="mt-3 text-lg leading-snug text-ink-soft">
          Show up to a climbing session, a trivia night or a run club, and leave with friends who love it too.
        </p>
      </section>

      <section className="px-6 pb-8">
        {mode === 'start' && (
          <div className="flex flex-col gap-3 animate-rise">
            <button type="button" className="btn btn-primary py-3.5 text-lg" onClick={demo} disabled={busy}>
              {busy ? 'Opening…' : 'Look around as Maya'}
            </button>
            <button type="button" className="btn btn-ghost py-3.5 text-lg" onClick={() => setMode('email')}>Sign up with email</button>
            <p className="text-center text-xs text-ink-soft">The demo signs you in as a sample member in Fremont, with friends and plans already set up.</p>
          </div>
        )}

        {mode === 'email' && (
          <form onSubmit={sendCode} className="flex flex-col gap-3 animate-rise">
            <label className="font-semibold" htmlFor="email">Your email</label>
            <input id="email" className="input" type="email" required autoFocus placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !email}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button>
            <button type="button" className="text-sm font-semibold underline" onClick={() => setMode('start')}>Back</button>
          </form>
        )}

        {mode === 'code' && (
          <form onSubmit={verify} className="flex flex-col gap-3 animate-rise">
            <label className="font-semibold" htmlFor="code">Enter the 6-digit code sent to {email}</label>
            <input id="code" className="input text-center font-mono text-2xl tracking-[0.4em]" inputMode="numeric" maxLength={6} required autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            {devCode && <p className="rounded-xl border-2 border-dashed border-ink bg-sun-soft p-2 text-center text-xs">Development mode: the code is filled in for you ({devCode}).</p>}
            <button className="btn btn-primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" className="text-sm font-semibold underline" onClick={() => setMode('email')}>Use a different email</button>
          </form>
        )}

        {err && <p className="mt-3 rounded-xl border-2 border-ink bg-coral-soft p-3 text-sm font-semibold" role="alert">{err}</p>}
      </section>

      <section className="border-t-2 border-ink bg-white px-6 py-8">
        <h2 className="font-display text-2xl font-extrabold">How it works</h2>
        <ul className="mt-4 space-y-4">
          {PROMISES.map(p => (
            <li key={p.title} className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-ink bg-paper text-xl">{p.emoji}</span>
              <div>
                <div className="font-display text-lg font-bold">{p.title}</div>
                <p className="text-sm text-ink-soft">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-xs text-ink-soft">18+ only · First name and last initial only · Never your exact location</p>
      </section>
    </main>
  )
}
