import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Flame, Mail, MessageCircle, UserRound, HeartHandshake, ShieldAlert } from 'lucide-react'
import { Button, Logo } from '../components/ui'
import { api } from '../lib/api'
import { useLive } from '../lib/hooks'
import { useSession } from '../lib/session'

function Badge({ n }) {
  if (!n) return null
  return <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white text-[11px] font-bold flex items-center justify-center">{n > 9 ? '9+' : n}</span>
}

// "Está tudo bem?" do Modo Encontro Seguro (aparece em qualquer tela)
function CheckinModal() {
  const { data } = useLive(() => api.listSafeDates())
  const due = data?.find(d => d.status === 'checkin_sent')
  if (!due) return null
  return (
    <div className="fixed inset-0 z-[60] bg-ink/70 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center animate-pop">
        <HeartHandshake className="w-14 h-14 text-primary mx-auto" />
        <h2 className="text-[26px] font-extrabold mt-3">Está tudo bem?</h2>
        <p className="text-ink-soft mt-1 text-[15px]">Seu encontro com <b>{due.partner_name}</b> em {due.place} deveria ter terminado. Se não responder em 30 minutos, avisaremos seus contatos de confiança.</p>
        <Button variant="green" className="w-full mt-5" onClick={() => api.respondCheckin(due.id, true)}>Estou bem 💙</Button>
        <Button variant="love" className="w-full mt-2.5" onClick={() => api.respondCheckin(due.id, false)}><ShieldAlert className="w-5 h-5" />Preciso de ajuda</Button>
      </div>
    </div>
  )
}

export default function AppShell() {
  const { profile } = useSession()
  const { pathname } = useLocation()
  const { data: inv } = useLive(() => api.listInvites())
  const { data: convs } = useLive(() => api.listConversations())
  const invN = inv?.received.filter(i => i.status === 'pending').length || 0
  const chatN = convs?.reduce((s, c) => s + (c.unread || 0), 0) || 0
  const items = [
    ['/app/descobrir', 'Descobrir', Flame, 0],
    ['/app/convites', 'Convites', Mail, invN],
    ['/app/conversas', 'Conversas', MessageCircle, chatN],
    ['/app/perfil', 'Perfil', UserRound, 0],
  ]
  const inChat = /\/app\/conversas\/.+/.test(pathname)

  return (
    <div className="min-h-screen lg:flex">
      {/* Navegação lateral (computador) */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-surface-highest bg-white sticky top-0 h-screen">
        <div className="p-5"><Logo className="w-36" /></div>
        <nav className="flex flex-col gap-1 px-3">
          {items.map(([to, label, I, n]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 font-display font-semibold text-[16px] ${isActive ? 'bg-secondary-fixed/60 text-secondary' : 'text-ink-soft hover:bg-surface-low'}`}>
              <span className="relative"><I className="w-6 h-6" /><Badge n={n} /></span>{label}
            </NavLink>))}
        </nav>
        <div className="mt-auto p-5 text-[13px] text-ink-soft">Olá, <b className="text-ink">{profile.name}</b></div>
      </aside>

      <div className={`flex-1 min-w-0 ${inChat ? '' : 'pb-20'} lg:pb-0`}>
        <Outlet />
      </div>

      {/* Barra inferior (celular) */}
      {!inChat && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-surface-highest safe-bottom">
          <div className="max-w-xl mx-auto grid grid-cols-4">
            {items.map(([to, label, I, n]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-bold ${isActive ? 'text-secondary' : 'text-ink-mute'}`}>
                <span className="relative"><I className="w-6 h-6" /><Badge n={n} /></span>{label}
              </NavLink>))}
          </div>
        </nav>
      )}
      <CheckinModal />
    </div>
  )
}
