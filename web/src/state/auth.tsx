import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler, socket } from '../api/client'
import type { Hobby, Me, Neighborhood } from '../api/client'

interface AuthState {
  token: string | null
  me: Me | null
  loading: boolean
  signIn: (token: string, me?: Me) => Promise<void>
  signOut: () => void
  refreshMe: () => Promise<Me | null>
  setMe: (me: Me) => void
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState<boolean>(!!getToken())

  const signOut = useCallback(() => {
    setToken(null)
    setTok(null)
    setMe(null)
    socket.disconnect()
  }, [])

  useEffect(() => { setUnauthorizedHandler(signOut) }, [signOut])

  const refreshMe = useCallback(async () => {
    try {
      const m = await api.me()
      setMe(m)
      return m
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    refreshMe().finally(() => setLoading(false))
    socket.connect()
  }, [token, refreshMe])

  const signIn = useCallback(async (t: string, m?: Me) => {
    setToken(t)
    if (m) setMe(m)
    setTok(t)
  }, [])

  const value = useMemo(() => ({ token, me, loading, signIn, signOut, refreshMe, setMe }), [token, me, loading, signIn, signOut, refreshMe])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const v = useContext(AuthCtx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}

/* ---------- Reference data (hobbies, neighborhoods) ---------- */

interface RefState {
  hobbies: Hobby[]
  hobbyMap: Record<string, Hobby>
  neighborhoods: Neighborhood[]
  addHobby: (h: Hobby) => void
}

const RefCtx = createContext<RefState>({ hobbies: [], hobbyMap: {}, neighborhoods: [], addHobby: () => {} })

export function RefProvider({ children }: { children: ReactNode }) {
  const [hobbies, setHobbies] = useState<Hobby[]>([])
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  useEffect(() => {
    api.hobbies().then(setHobbies).catch(() => {})
    api.neighborhoods().then(setNeighborhoods).catch(() => {})
  }, [])
  const value = useMemo(() => {
    const hobbyMap: Record<string, Hobby> = {}
    for (const h of hobbies) hobbyMap[h.id] = h
    return {
      hobbies, hobbyMap, neighborhoods,
      addHobby: (h: Hobby) => setHobbies(prev => (prev.some(p => p.id === h.id) ? prev : [...prev, h])),
    }
  }, [hobbies, neighborhoods])
  return <RefCtx.Provider value={value}>{children}</RefCtx.Provider>
}

export function useRefData() { return useContext(RefCtx) }

export function useHobby(id: string | null | undefined): Hobby {
  const { hobbyMap } = useContext(RefCtx)
  if (id && hobbyMap[id]) return hobbyMap[id]
  if (id === '_host') return { id, name: 'Host', emoji: '🎪', category: 'Custom' }
  const name = (id ?? 'hobby').replace(/[-_]/g, ' ')
  return { id: id ?? '', name: name.charAt(0).toUpperCase() + name.slice(1), emoji: '✨', category: 'Custom' }
}
