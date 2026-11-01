import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Bell, BellRing, Camera, ClipboardCheck, Hourglass, LogOut, PauseCircle, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useSession } from '../lib/session'
import { canNotify, askNotify } from '../lib/notify'

const STEPS = [
  ['Conferência da identidade', 'Comparamos a selfie com o documento e com as suas 3 fotos.', 'bg-primary'],
  ['Aviso na hora', 'Você recebe uma notificação assim que a conta for liberada.', 'bg-secondary-container'],
  ['Selo de Verificado', 'Seu perfil ganha a insígnia oficial de autenticidade.', 'bg-tertiary'],
  ['Privacidade e LGPD', 'A foto do documento é excluída definitivamente após a análise.', 'bg-surface-highest !text-primary'],
]

export default function Waiting() {
  const { profile, refresh } = useSession()
  const nav = useNavigate()
  const [checking, setChecking] = useState(false)
  const [notif, setNotif] = useState(canNotify())

  // Confere o status periodicamente (além do tempo real)
  useEffect(() => { const t = setInterval(refresh, 15000); return () => clearInterval(t) }, [refresh])
  async function check() { setChecking(true); await refresh(); setTimeout(() => setChecking(false), 600) }

  const st = profile.status
  const view = {
    pending_review: { icon: ShieldCheck, badge: 'Status: Em análise pelos moderadores', tone: 'bg-amber/20 text-[#7a4d00]', dot: 'bg-amber', title: 'Estamos conferindo seus dados!', text: <>Nossa equipe está verificando sua selfie e documento para manter a comunidade do <b className="text-primary">ITAC LOVE</b> segura. Isso costuma levar <b className="text-secondary">até 24 horas</b>.</> },
    needs_new_photo: { icon: Camera, badge: 'Status: Nova foto necessária', tone: 'bg-amber/20 text-[#7a4d00]', dot: 'bg-amber', title: 'Precisamos de uma nova selfie', text: <>A moderação pediu uma nova foto: <b>{profile.rejection_reason}</b></> },
    rejected: { icon: XCircle, badge: 'Status: Verificação reprovada', tone: 'bg-secondary-fixed text-secondary', dot: 'bg-secondary', title: 'Sua verificação não foi aprovada', text: <>Motivo: <b>{profile.rejection_reason}</b>. Você pode corrigir os dados e enviar novamente.</> },
    under_review: { icon: ShieldAlert, badge: 'Status: Conta em revisão', tone: 'bg-amber/20 text-[#7a4d00]', dot: 'bg-amber', title: 'Sua conta está em revisão', text: 'Recebemos sinais que precisam ser conferidos pela moderação. Enquanto isso, o acesso fica pausado.' },
    suspended: { icon: PauseCircle, badge: 'Status: Conta suspensa', tone: 'bg-secondary-fixed text-secondary', dot: 'bg-secondary', title: 'Conta suspensa temporariamente', text: <>Sua conta foi suspensa por violar as regras da comunidade{profile.suspended_until ? <> até <b>{new Date(profile.suspended_until).toLocaleString('pt-BR')}</b></> : ''}.</> },
    banned: { icon: Ban, badge: 'Status: Conta banida', tone: 'bg-secondary-fixed text-secondary', dot: 'bg-secondary', title: 'Conta banida', text: 'Esta conta foi banida permanentemente por violar os Termos de Uso do ITAC LOVE.' },
  }[st] || {}
  const Icon = view.icon || Hourglass

  return (
    <div className="min-h-screen px-4 pb-10">
      <div className="max-w-xl mx-auto pt-8 text-center">
        <div className="mx-auto w-48 h-48 rounded-full bg-primary-fixed/30 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full bg-white shadow-[0_0_0_10px_rgba(255,218,219,.5)] flex items-center justify-center relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center"><Icon className="w-11 h-11 text-white" /></div>
            {st === 'pending_review' && <span className="absolute bottom-5 right-5 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center"><Hourglass className="w-5 h-5 text-secondary animate-pulse" /></span>}
          </div>
        </div>
        <span className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-semibold ${view.tone}`}><span className={`w-2.5 h-2.5 rounded-full ${view.dot} ${st === 'pending_review' ? 'animate-pulse' : ''}`} />{view.badge}</span>
        <h1 className="mt-4 text-[30px] font-extrabold leading-tight">{view.title}</h1>
        <p className="mt-3 text-ink-soft text-[16px] leading-relaxed">{view.text}</p>

        {st === 'needs_new_photo' && <Button variant="love" className="w-full mt-6" onClick={() => nav('/cadastro/verificacao')}><Camera className="w-5 h-5" />Enviar nova selfie</Button>}
        {st === 'rejected' && <Button variant="love" className="w-full mt-6" onClick={() => nav('/cadastro/perfil')}>Corrigir e reenviar</Button>}

        {st === 'pending_review' && (
          <Card className="mt-7 p-5 text-left bg-surface-low shadow-none">
            <div className="flex items-center gap-2 font-display font-semibold text-[18px]"><ClipboardCheck className="w-5 h-5 text-primary" />O que acontece agora?</div>
            <ol className="mt-4 space-y-4">{STEPS.map(([t, d, c], i) => (
              <li key={t} className="flex gap-4"><span className={`w-9 h-9 rounded-full ${c} text-white font-bold flex items-center justify-center shrink-0`}>{i + 1}</span><div><div className="font-display font-semibold text-[17px]">{t}</div><div className="text-[14px] text-ink-soft">{d}</div></div></li>))}
            </ol>
          </Card>
        )}

        {st === 'pending_review' && notif !== 'granted' && notif !== 'unsupported' && (
          <button onClick={async () => setNotif(await askNotify())} className="mt-4 w-full flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm text-left">
            <span className="w-12 h-12 rounded-full bg-tertiary-fixed/60 flex items-center justify-center shrink-0"><Bell className="w-6 h-6 text-tertiary" /></span>
            <span className="flex-1"><b className="block">Quero ser avisado(a)</b><span className="text-[14px] text-ink-soft">Ative as notificações para saber assim que for aprovado.</span></span>
          </button>
        )}
        {notif === 'granted' && st === 'pending_review' && <p className="mt-4 inline-flex items-center gap-2 text-tertiary font-semibold text-[14px]"><BellRing className="w-4 h-4" />Notificações ativadas</p>}

        {isDemo && st === 'pending_review' && (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-violet/40 bg-violet/5 p-4 text-[14px] text-left">
            <b className="text-violet">Modo demonstração</b>
            <p className="text-ink-soft mt-1">Aprove pelo <a href="#/admin/verificacoes" className="text-primary underline font-semibold">Painel do Administrador</a> (admin@itaclove.com / admin123) ou use o atalho:</p>
            <Button variant="green" className="w-full mt-3" onClick={() => api.demoSelfApprove()}>Aprovar minha conta agora (atalho)</Button>
          </div>
        )}
        {!['banned'].includes(st) && <Button variant="ocean" className="w-full mt-6" onClick={check} loading={checking}>{!checking && <RefreshCw className="w-5 h-5" />}Verificar status novamente</Button>}
        <button onClick={() => api.signOut()} className="mt-5 inline-flex items-center gap-2 text-ink-soft font-semibold"><LogOut className="w-5 h-5" />Sair da conta</button>
      </div>
    </div>
  )
}
