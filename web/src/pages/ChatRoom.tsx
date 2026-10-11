import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { api, socket, useApi, useSocket } from '../api/client'
import type { Message } from '../api/client'
import { useAuth } from '../state/auth'
import { Avatar, ErrorNote, PageHeader, Skeleton } from '../components/ui'
import { parseDate, timeLabel } from '../lib/format'
import { chatTitle } from './Chats'

export default function ChatRoom() {
  const { id } = useParams()
  const chatId = Number(id)
  const { me } = useAuth()
  const { data: chat } = useApi(() => api.chat(chatId), [chatId])
  const { data: msgs, setData: setMsgs, error, loading, reload } = useApi(() => api.messages(chatId), [chatId])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)
  const [typing, setTyping] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastTyping = useRef(0)
  const typingTimer = useRef<number | undefined>(undefined)

  const sorted = msgs ? [...msgs].sort((a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime()) : []

  useLayoutEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [sorted.length])

  useEffect(() => () => window.clearTimeout(typingTimer.current), [])
  useEffect(() => { if (msgs) api.markRead(chatId).catch(() => {}) }, [chatId, msgs?.length])

  useSocket(e => {
    if (e.type === 'message' && 'message' in e) {
      const m = e.message as Message
      if (m.chat_id !== chatId) return
      setMsgs(prev => (prev && !prev.some(x => x.id === m.id) ? [...prev, m] : prev))
      setTyping(null)
    } else if (e.type === 'typing' && (e as { chat_id?: number }).chat_id === chatId) {
      const u = (e as { user?: { id: number; display_name: string } }).user
      if (u && u.id === me?.id) return
      setTyping(u?.display_name.split(' ')[0] ?? 'Someone')
      window.clearTimeout(typingTimer.current)
      typingTimer.current = window.setTimeout(() => setTyping(null), 3000)
    }
  })

  function onType(v: string) {
    setBody(v)
    setSendErr(null)
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now()
      socket.send({ type: 'typing', chat_id: chatId })
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setSending(true)
    try {
      const m = await api.send(chatId, text)
      setMsgs(prev => (prev && !prev.some(x => x.id === m.id) ? [...prev, m] : prev ?? [m]))
      setBody('')
    } catch (err) { setSendErr(err instanceof Error ? err.message : 'Message not sent') } finally { setSending(false) }
  }

  const title = chat ? chatTitle(chat, me?.id) : 'Chat'

  return (
    <main className="flex h-dvh flex-col">
      <PageHeader title={title} back="/chats" right={chat?.activity_id ? <Link to={`/activities/${chat.activity_id}`} className="btn btn-ghost btn-sm">Details</Link> : undefined}
        sub={chat && chat.kind !== 'dm' ? <p className="truncate text-xs text-ink-soft">{chat.members.map(m => m.display_name.split(' ')[0]).join(', ')}</p> : undefined} />

      <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-live="polite">
        {chat?.activity_cancelled && <p className="mb-3 rounded-xl border-2 border-ink bg-coral-soft p-2 text-center text-xs font-semibold">This activity was cancelled. You can still read the chat.</p>}
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading && !msgs && <div className="space-y-3">{[60, 40, 70].map(w => <Skeleton key={w} className="h-10" />)}</div>}
        {msgs && sorted.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-soft">
            {chat?.kind === 'activity' ? 'Everyone going is here. Say hi, sort out rides, or share where you are.' : 'Say hi and suggest something to do together.'}
          </p>
        )}
        {sorted.map((m, i) => {
          const mine = m.user.id === me?.id
          const prev = sorted[i - 1]
          const grouped = prev && prev.user.id === m.user.id && parseDate(m.created_at).getTime() - parseDate(prev.created_at).getTime() < 5 * 60e3
          const showDay = !prev || parseDate(prev.created_at).toDateString() !== parseDate(m.created_at).toDateString()
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 text-center font-mono text-[10px] font-bold tracking-wider text-ink-soft">
                  {parseDate(m.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                </div>
              )}
              <div className={`flex items-end gap-2 ${mine ? 'justify-end' : ''} ${grouped ? '' : 'mt-3'}`}>
                {!mine && <div className="w-8 shrink-0">{!grouped && <Avatar user={m.user} size={32} />}</div>}
                <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mine && !grouped && chat?.kind !== 'dm' && <span className="mb-0.5 ml-1 text-xs font-bold text-ink-soft">{m.user.display_name}</span>}
                  <div className={`rounded-2xl border-2 border-ink px-3 py-2 text-[15px] leading-snug break-words ${mine ? 'rounded-br-md bg-coral' : 'rounded-bl-md bg-white'}`}>
                    {m.body}
                  </div>
                  {!grouped && <span className="mt-0.5 px-1 font-mono text-[10px] text-ink-soft">{timeLabel(m.created_at)}</span>}
                </div>
              </div>
            </div>
          )
        })}
        {typing && <p className="mt-2 ml-10 text-xs font-semibold text-ink-soft animate-pulse">{typing} is typing…</p>}
      </div>

      <form onSubmit={send} className="border-t-2 border-ink bg-white px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {sendErr && <p className="mb-2 rounded-lg bg-coral-soft px-3 py-1.5 text-xs font-semibold" role="alert">{sendErr}</p>}
        <div className="flex gap-2">
          <input className="input flex-1 rounded-full" placeholder="Message" value={body} onChange={e => onType(e.target.value)} aria-label="Message" maxLength={1000} />
          <button className="btn btn-primary px-4" disabled={sending || !body.trim()} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
      </form>
    </main>
  )
}
