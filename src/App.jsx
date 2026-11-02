import { useEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SessionProvider, homeFor, useSession } from './lib/session'
import { api } from './lib/api'
import { isNative, isNewer, platformName } from './lib/platform'
import { DemoBanner, Spinner } from './components/ui'
import Splash from './screens/Splash'
import Login from './screens/Login'
import ProfileStep from './screens/ProfileStep'
import PhotosStep from './screens/PhotosStep'
import InterestsStep from './screens/InterestsStep'
import VerificationStep from './screens/VerificationStep'
import Waiting from './screens/Waiting'
import AppShell from './app/AppShell'
import Feed from './app/Feed'
import Invites from './app/Invites'
import Conversations from './app/Conversations'
import SafeDate from './app/SafeDate'
import Store from './app/Store'
import Profile from './app/Profile'
import Terms from './legal/Terms'
import Privacy from './legal/Privacy'
import AdminApp from './admin/AdminApp'
import UpdateBanner from './components/UpdateBanner'

// Bloqueia rotas conforme o status da conta
function Gate({ allow, children }) {
  const s = useSession()
  if (s.loading) return <Spinner />
  const home = homeFor(s)
  if (!s.user) return <Navigate to="/entrar" replace />
  if (s.isAdmin) return <Navigate to="/admin" replace />
  if (!allow.includes(s.profile?.status)) return <Navigate to={home} replace />
  return children
}

const ONBOARDING = ['onboarding', 'needs_new_photo', 'rejected']

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppRoutes() {
  const s = useSession()
  const [update, setUpdate] = useState(null)

  // Registra acesso por plataforma e verifica atualização do APK (uma vez por usuário/abertura)
  const accessed = useRef(null)
  const uid = s.user?.id
  useEffect(() => {
    if (!uid || accessed.current === uid) return
    accessed.current = uid
    api.recordAccess(platformName()).then(info => {
      if (isNative() && info?.latest_app_version && isNewer(info.latest_app_version)) setUpdate(info)
    }).catch(() => {})
  }, [uid])

  return (
    <>
      <ScrollTop />
      {update && <UpdateBanner info={update} onClose={() => setUpdate(null)} />}
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/entrar" element={s.user && !s.loading ? <Navigate to={homeFor(s)} replace /> : <Login />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/cadastro/perfil" element={<Gate allow={ONBOARDING}><ProfileStep /></Gate>} />
        <Route path="/cadastro/fotos" element={<Gate allow={ONBOARDING}><PhotosStep /></Gate>} />
        <Route path="/cadastro/interesses" element={<Gate allow={ONBOARDING}><InterestsStep /></Gate>} />
        <Route path="/cadastro/verificacao" element={<Gate allow={ONBOARDING}><VerificationStep /></Gate>} />
        <Route path="/aguardando" element={<Gate allow={['pending_review', 'needs_new_photo', 'rejected', 'under_review', 'suspended', 'banned']}><Waiting /></Gate>} />
        <Route path="/inicio" element={<Navigate to="/app/descobrir" replace />} />
        <Route path="/app" element={<Gate allow={['approved']}><AppShell /></Gate>}>
          <Route index element={<Navigate to="descobrir" replace />} />
          <Route path="descobrir" element={<Feed />} />
          <Route path="convites" element={<Invites />} />
          <Route path="conversas/:id?" element={<Conversations />} />
          <Route path="encontro/:convId" element={<SafeDate />} />
          <Route path="loja" element={<Store />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <DemoBanner />
        <AppRoutes />
      </HashRouter>
    </SessionProvider>
  )
}
