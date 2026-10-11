import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, useApi } from '../api/client'
import { useAuth, useHobby } from '../state/auth'
import { ErrorNote, PageHeader, Skeleton, toast } from '../components/ui'

const TRAIT_LABEL: Record<string, [string, string]> = {
  competitive: ['Here for fun', 'Here to win'],
  chill: ['High energy', 'Easygoing'],
  chatty: ['Quiet type', 'Talker'],
  planner: ['Spontaneous', 'Planner'],
  night_owl: ['Early bird', 'Night owl'],
}

export default function Vibe() {
  const nav = useNavigate()
  const { refreshMe } = useAuth()
  const { data: qs, error, loading, reload } = useApi(() => api.vibeQuestions(), [])
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ vibe: Record<string, number>; summary: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const q = qs?.[i]
  const total = qs?.length ?? 0

  async function pick(optionId: string) {
    if (!q) return
    const next = { ...answers, [q.id]: optionId }
    setAnswers(next)
    if (i + 1 < total) { setI(i + 1); return }
    setBusy(true)
    try {
      const r = await api.setVibe(Object.entries(next).map(([question_id, option_id]) => ({ question_id, option_id })))
      setResult(r)
      refreshMe()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save your answers') } finally { setBusy(false) }
  }

  if (error) return <><PageHeader title="Vibe Check" back /><ErrorNote message={error} onRetry={reload} /></>

  return (
    <main className="flex min-h-dvh flex-col">
      <PageHeader title="Vibe Check" back sub={total > 0 && !result ? (
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
            <div className="h-full bg-coral transition-all duration-500" style={{ width: `${(i / total) * 100}%` }} />
          </div>
          <span className="font-mono text-xs font-bold">{i + 1}/{total}</span>
        </div>
      ) : undefined} />

      {loading && !qs && <div className="space-y-3 p-5"><Skeleton className="h-32" />{[0, 1, 2, 3].map(k => <Skeleton key={k} className="h-14" />)}</div>}

      {q && !result && (
        <div key={q.id} className="flex-1 px-5 py-6 animate-rise">
          <Scenario hobbyId={q.hobby_id} />
          <h1 className="mt-4 font-display text-2xl leading-snug font-extrabold">{q.prompt}</h1>
          <p className="mt-1 text-sm text-ink-soft">What do you do?</p>
          <div className="mt-5 space-y-3">
            {q.options.map((o, k) => (
              <button key={o.id} type="button" disabled={busy} onClick={() => pick(o.id)}
                className={`sticker sticker-press flex w-full items-center gap-3 p-4 text-left font-semibold animate-rise ${answers[q.id] === o.id ? 'bg-sun' : ''}`}
                style={{ animationDelay: `${k * 60}ms` }}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper font-mono text-xs">{String.fromCharCode(65 + k)}</span>
                {o.text}
              </button>
            ))}
          </div>
          {i > 0 && <button type="button" className="mt-5 text-sm font-semibold underline" onClick={() => setI(i - 1)}>Previous question</button>}
        </div>
      )}

      {result && (
        <div className="flex-1 px-5 py-8 animate-rise">
          <div className="text-5xl">✨</div>
          <h1 className="mt-3 font-display text-3xl font-extrabold">Your vibe</h1>
          <p className="mt-2 text-lg leading-snug">{result.summary}</p>
          <ul className="mt-6 space-y-4">
            {Object.entries(result.vibe).map(([k, v]) => {
              const [lo, hi] = TRAIT_LABEL[k] ?? [k, k]
              const pct = ((v + 1) / 2) * 100
              return (
                <li key={k}>
                  <div className="mb-1 flex justify-between text-xs font-bold"><span>{lo}</span><span>{hi}</span></div>
                  <div className="relative h-3 rounded-full border-2 border-ink bg-gradient-to-r from-teal-soft via-white to-coral-soft">
                    <span className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-sun shadow-[2px_2px_0_#1F1A17] transition-all duration-700" style={{ left: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-6 text-sm text-ink-soft">This adds up to 10 points to your Friend Score with people whose vibe matches yours.</p>
          <button type="button" className="btn btn-primary mt-6 w-full py-3.5" onClick={() => nav('/people')}>See who matches</button>
        </div>
      )}
    </main>
  )
}

function Scenario({ hobbyId }: { hobbyId?: string | null }) {
  const h = useHobby(hobbyId)
  if (!hobbyId) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-lilac-soft px-3 py-1 text-sm font-bold">
      <span aria-hidden>{h.emoji}</span>{h.name}
    </span>
  )
}
