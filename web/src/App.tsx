import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { api, useSocket } from './api/client'
import { useAuth } from './state/auth'
import { BottomTabs, Toaster } from './components/ui'
import { Logo } from './components/Logo'
import Welcome from './pages/Welcome'
import Onboarding from './pages/Onboarding'
import Activities from './pages/Activities'
import ActivityDetail from './pages/ActivityDetail'
import Host from './pages/Host'
import People from './pages/People'
import PersonProfile from './pages/PersonProfile'
import Chats from './pages/Chats'
import ChatRoom from './pages/ChatRoom'
import MePage from './pages/Me'
import Vibe from './pages/Vibe'

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={64} spin />
        <span className="font-display text-xl font-extrabold">Tandem</span>
      </div>
    </div>
  )
}

/** Requires sign-in; sends new users to onboarding. */
function Guard() {
  const { token, me, loading } = useAuth()
  const loc = useLocation()
  if (!token) return <Navigate to="/welcome" replace />
  if (loading && !me) return <Splash />
  if (me && !me.is_business && (me.onboarded === false || (me.onboarded === undefined && !me.hobbies?.length)) && loc.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return <Outlet />
}

function TabLayout() {
  const [unread, setUnread] = useState(0)
  const loc = useLocation()
  useEffect(() => {
    api.chats().then(cs => setUnread(cs.reduce((n, c) => n + (c.unread || 0), 0))).catch(() => {})
  }, [loc.pathname])
  useSocket(e => { if (e.type === 'message' && !loc.pathname.startsWith('/chats/')) setUnread(n => n + 1) })
  return (
    <>
      <div className="pb-24"><Outlet /></div>
      <BottomTabs unread={unread} />
    </>
  )
}

export default function App() {
  return (
    <div className="app-frame">
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route element={<Guard />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/vibe" element={<Vibe />} />
          <Route path="/host" element={<Host />} />
          <Route path="/chats/:id" element={<ChatRoom />} />
          <Route element={<TabLayout />}>
            <Route path="/" element={<Activities />} />
            <Route path="/activities/:id" element={<ActivityDetail />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/:id" element={<PersonProfile />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/me" element={<MePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </div>
  )
}
