import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { BarChart3, LogOut, Settings, ShieldCheck, KeyRound, Mail, Info, Flag, Users as UsersIcon, Wallet } from 'lucide-react'
import { Button, Card, ErrorBox, Logo, Spinner } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useSession } from '../lib/session'
import { friendlyError } from '../lib/constants'
import Dashboard from './Dashboard'
import VerificationQueue from './VerificationQueue'
import SettingsPage from './SettingsPage'
import Reports from './Reports'
import Users from './Users'
import Sales from './Sales'

function AdminLogin() {
  const [email, setEmail] = useState(isDemo ? 'admin@itaclove.com' : '')
  const [password, setPassword] = useState(isDemo ? 'admin123' : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    try { await api.signInEmail(email, password) } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-ink to-primary">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center"><Logo className="w-40" /><span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink text-white text-[12px] font-bold px-3 py-1"><ShieldCheck className="w-4 h-4" />PAINEL DO ADMINISTRADOR</span></div>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" /><input className="field pl-12" type="email" required placeholder="E-mail do administrador" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="relative"><KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" /><input className="field pl-12" type="password" required placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <ErrorBox>{error}</ErrorBox>
          <Button variant="ocean" type="submit" loading={loading} className="w-full">Entrar no painel</Button>
        </form>
        {isDemo && <p className="mt-4 text-[12px] text-ink-soft flex gap-2"><Info className="w-4 h-4 shrink-0 text-violet" />Demonstração: admin@itaclove.com / admin123 (já preenchido).</p>}
        <a href="#/" className="block text-center mt-4 text-[13px] text-primary font-semibold">← Voltar ao app</a>
      </Card>
    </div>
  )
}

const NAV = [['', 'Painel', BarChart3], ['verificacoes', 'Verificações', ShieldCheck], ['denuncias', 'Denúncias', Flag], ['usuarios', 'Usuários', UsersIcon], ['vendas', 'Vendas Pix', Wallet], ['configuracoes', 'Configurações', Settings]]

export default function AdminApp() {
  const s = useSession()
  if (s.loading) return <Spinner />
  if (!s.user) return <AdminLogin />
  if (!s.isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldCheck className="w-12 h-12 text-secondary" /><p className="font-semibold">Esta conta ({s.user.email}) não é de administrador.</p>
      <Button variant="ocean" onClick={() => api.signOut()}>Sair e entrar como admin</Button>
      <a href="#/" className="text-primary font-semibold">Voltar ao app</a>
    </div>)

  return (
    <div className="min-h-screen bg-surface lg:flex">
      <aside className="lg:w-60 lg:min-h-screen bg-ink text-white lg:flex lg:flex-col shrink-0">
        <div className="flex items-center justify-between lg:block px-4 py-3 lg:py-5">
          <div className="flex items-center gap-2"><div className="bg-white rounded-xl p-1"><Logo className="w-14" /></div><div className="text-[12px] font-bold leading-tight opacity-80">PAINEL<br />ADMIN</div></div>
          <button onClick={() => api.signOut()} className="lg:hidden inline-flex items-center gap-1 text-[13px] opacity-80"><LogOut className="w-4 h-4" />Sair</button>
        </div>
        <nav className="flex lg:flex-col gap-1 px-2 pb-2 overflow-x-auto">
          {NAV.map(([to, label, I]) => (
            <NavLink key={to} to={`/admin/${to}`} end className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-semibold whitespace-nowrap ${isActive ? 'bg-white/15' : 'opacity-75 hover:opacity-100'}`}><I className="w-5 h-5" />{label}</NavLink>))}
        </nav>
        <div className="hidden lg:block mt-auto p-4 text-[12px] opacity-70">
          {s.user.email}
          <button onClick={() => api.signOut()} className="mt-2 flex items-center gap-1.5 font-semibold opacity-100"><LogOut className="w-4 h-4" />Sair</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 lg:p-8">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="verificacoes" element={<VerificationQueue />} />
          <Route path="denuncias" element={<Reports />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="vendas" element={<Sales />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}
