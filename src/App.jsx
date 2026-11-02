import { Suspense, lazy, useEffect, useRef, useState } from 'react'
// O painel admin só é baixado quando alguém abre /admin (o app abre mais rápido)
const AdminApp = lazy(() => import('./admin/AdminApp'))
const Store = lazy(() => import('./app/Store'))
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
import Profile from './app/Profile'
import WhoLiked from './app/WhoLiked'
import Terms from './legal/Terms'
import Privacy from './legal/Privacy'
import UpdateBanner from './components/UpdateBanner'
import { initNotifications } from './lib/notify'

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

  // Notificações (uma vez por usuário logado); o token do push vai para o perfil
  const notifInit = useRef(null)
  useEffect(() => {
    if (!uid || notifInit.current === uid || s.isAdmin) return
    notifInit.current = uid
    initNotifications({ onToken: (token) => api.updateProfile({ fcm_token: token }).catch(() => {}) })
  }, [uid, s.isAdmin])

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
          <Route path="loja" element={<Suspense fallback={<Spinner />}><Store /></Suspense>} />
          <Route path="perfil" element={<Profile />} />
          <Route path="curtidas" element={<WhoLiked />} />
        </Route>
        <Route path="/admin/*" element={<Suspense fallback={<Spinner />}><AdminApp /></Suspense>} />
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
