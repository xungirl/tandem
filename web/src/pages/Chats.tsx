import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, useApi, useSocket } from '../api/client'
import type { ChatSummary } from '../api/client'
import { useAuth } from '../state/auth'
import { Avatar, AvatarStack, Empty, ErrorNote, HobbyEmoji, ListSkeleton, PageHeader, toast } from '../components/ui'
import { relTime } from '../lib/format'

export function chatTitle(c: ChatSummary, myId?: number) {
  if (c.name) return c.name
  const others = c.members.filter(m => m.id !== myId)
  if (c.kind === 'dm') return others[0]?.display_name ?? 'Chat'
  return others.map(m => m.display_name.split(' ')[0]).slice(0, 3).join(', ') + (others.length > 3 ? ` +${others.length - 3}` : '')
}

export default function Chats() {
  const { me } = useAuth()
  const nav = useNavigate()
  const { data, setData, error, loading, reload } = useApi(() => api.chats(), [])
  const [picking, setPicking] = useState(false)

  useSocket(e => {
    if (e.type !== 'message' || !('message' in e)) return
    const m = (e as { message: ChatSummary['last_message'] }).message!
    setData(prev => {
      if (!prev) return prev
      const c = prev.find(x => x.id === m.chat_id)
      if (!c) { reload(); return prev }
      const updated = { ...c, last_message: m, unread: m.user.id === me?.id ? c.unread : c.unread + 1 }
      return [updated, ...prev.filter(x => x.id !== m.chat_id)]
    })
  })

  return (
    <main>
      <PageHeader title="Chats" right={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>+ Group</button>} />
      <div className="px-4 py-4">
        {error && <ErrorNote message={error} onRetry={reload} />}
        {loading && !data && <ListSkeleton rows={6} h="h-16" />}
        {data?.length === 0 && (
          <Empty emoji="💬" title="No chats yet" body="Join an activity to get its group chat, or message someone from their profile."
            action={<Link to="/" className="btn btn-primary">Browse activities</Link>} />
        )}
        <ul className="divide-y-2 divide-ink/10">
          {data?.map(c => (
            <li key={c.id}>
              <Link to={`/chats/${c.id}`} className="flex items-center gap-3 py-3">
                {c.kind === 'activity' && c.avatar_hobby_id ? <HobbyEmoji id={c.avatar_hobby_id} size={48} />
                  : c.kind === 'dm' ? <Avatar user={c.members.find(m => m.id !== me?.id)} size={48} />
                  : <div className="grid h-12 w-12 place-items-center"><AvatarStack users={c.members.filter(m => m.id !== me?.id)} size={30} max={2} /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`truncate font-display ${c.unread ? 'font-extrabold' : 'font-bold'}`}>{chatTitle(c, me?.id)}</span>
                    {c.kind === 'activity' && <span className={`shrink-0 rounded-full border border-ink px-1.5 text-[10px] font-bold ${c.activity_cancelled ? 'bg-coral-soft' : 'bg-sun-soft'}`}>{c.activity_cancelled ? 'Cancelled' : 'Activity'}</span>}
                    {c.last_message && <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-soft">{relTime(c.last_message.created_at)}</span>}
                  </div>
                  <p className={`truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
                    {c.last_message ? `${c.last_message.user.id === me?.id ? 'You' : c.last_message.user.display_name.split(' ')[0]}: ${c.last_message.body}` : 'Say hi 👋'}
                  </p>
                </div>
                {c.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink bg-coral px-1 font-mono text-[11px] font-bold">{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {picking && <NewGroupSheet onClose={() => setPicking(false)} onCreated={id => nav(`/chats/${id}`)} />}
    </main>
  )
}

function NewGroupSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { data } = useApi(() => api.friends(), [])
  const [picked, setPicked] = useState<number[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const friends = data?.friends ?? []

  async function create() {
    setBusy(true)
    try { const c = await api.createGroup(picked, name.trim() || undefined); onCreated(c.id) } catch (e) { toast(e instanceof Error ? e.message : 'Could not create the group') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={onClose} role="dialog" aria-modal aria-label="New group chat">
      <div className="max-h-[80dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border-2 border-ink bg-paper p-5 animate-rise" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-2xl font-extrabold">Start a group chat</h2>
        <p className="text-sm text-ink-soft">Group chats are for friends. Pick at least two.</p>
        <input className="input mt-3" placeholder="Name it (optional), e.g. Board game crew" value={name} onChange={e => setName(e.target.value)} />
        <ul className="mt-3 space-y-1">
          {friends.length === 0 && <li className="py-6 text-center text-sm text-ink-soft">No friends yet. Add people from their profile first.</li>}
          {friends.map(f => {
            const on = picked.includes(f.id)
            return (
              <li key={f.id}>
                <button type="button" onClick={() => setPicked(on ? picked.filter(x => x !== f.id) : [...picked, f.id])} aria-pressed={on}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white">
                  <Avatar user={f} size={40} />
                  <span className="flex-1 font-semibold">{f.display_name}</span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border-2 border-ink ${on ? 'bg-teal' : 'bg-white'}`}>{on ? '✓' : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-primary mt-4 w-full" disabled={picked.length < 2 || busy} onClick={create}>
          {busy ? 'Creating…' : `Create group${picked.length ? ` (${picked.length + 1})` : ''}`}
        </button>
      </div>
    </div>
  )
}
