import { useEffect, useState } from 'react'
import { Bell, EyeOff, Heart, LogOut, MapPin, PauseCircle, ShoppingBag, Trash2, PartyPopper, ChevronRight, Crown, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLive } from '../lib/hooks'
import { Button, Card, Logo, VerifiedBadge } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { LOOKING_FOR, ageFrom, genderLabel } from '../lib/constants'

function Toggle({ on, onChange, icon: I, title, desc }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center gap-3 py-3 text-left" aria-pressed={on}>
      <I className="w-5 h-5 text-primary shrink-0" />
      <span className="flex-1"><b className="block text-[15px]">{title}</b><span className="text-[13px] text-ink-soft">{desc}</span></span>
      <span className={`w-12 h-7 rounded-full p-1 transition ${on ? 'bg-tertiary' : 'bg-ink-line'}`}><span className={`block w-5 h-5 rounded-full bg-white transition ${on ? 'translate-x-5' : ''}`} /></span>
    </button>
  )
}

export default function Profile() {
  const { profile, refresh } = useSession()
  const [photos, setPhotos] = useState([])
  const [tags, setTags] = useState([])
  const [welcome, setWelcome] = useState(false)
  const [del, setDel] = useState(0)
  const { data: quota } = useLive(() => api.quotaStatus())
  const { data: notes } = useLive(() => api.listNotifications())

  useEffect(() => {
    api.getMyPhotos().then(setPhotos)
    Promise.all([api.listTags(), api.getMyInterests()]).then(([all, mine]) => setTags(all.filter(t => mine.includes(t.id))))
    try { const k = 'itac_welcome_' + profile.id; if (!localStorage.getItem(k)) { setWelcome(true); localStorage.setItem(k, '1') } } catch { /* sem storage */ }
  }, [profile.id])

  async function setFlag(k, v) { await api.updateProfile({ [k]: v }); refresh() }
  const look = LOOKING_FOR.find(l => l.id === profile.looking_for)

  return (
    <div className="pb-10">
      <header className="bg-white/80 backdrop-blur sticky top-0 z-10 border-b border-surface-highest">
        <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between">
          <Logo className="w-24 lg:hidden" /><h1 className="hidden lg:block text-[24px] font-bold">Meu perfil</h1>
          <button onClick={() => api.signOut()} className="inline-flex items-center gap-1.5 text-ink-soft font-semibold text-[14px]"><LogOut className="w-4 h-4" />Sair</button>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-5">
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] bg-surface-mid">
            {photos[0] && <PhotoImg path={photos[0].path} className="w-full h-full object-cover no-select" alt="Sua foto principal" />}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 to-transparent text-white">
              <div className="flex items-center gap-2 flex-wrap"><h1 className="text-[28px] font-bold">{profile.name}, {ageFrom(profile.birth_date)}</h1><VerifiedBadge /></div>
              <div className="flex items-center gap-1 text-[14px] opacity-90"><MapPin className="w-4 h-4" />{profile.city} · {genderLabel(profile.gender_identity, profile.gender_other)}</div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">{photos.slice(1).map(p => <PhotoImg key={p.path} path={p.path} className="w-20 h-24 rounded-xl object-cover" alt="" />)}</div>
            {look && <div className="inline-flex items-center gap-2 rounded-full bg-secondary-fixed/60 px-3 py-1 text-[13px] font-semibold"><Heart className="w-4 h-4 text-secondary" />{look.label}</div>}
            <p className="text-[15px] text-ink-soft">{profile.bio}</p>
            <div className="flex flex-wrap gap-1.5">{tags.map(t => <span key={t.id} className="rounded-full bg-surface-mid px-3 py-1 text-[13px] font-semibold">{t.label}</span>)}</div>
          </div>
        </Card>

        <Card className="divide-y divide-surface-highest overflow-hidden">
          <Link to="/app/loja" className="flex items-center gap-3 p-4 hover:bg-surface-low"><ShoppingBag className="w-5 h-5 text-violet" /><span className="flex-1"><b className="block">Loja e histórico de compras</b><span className="text-[13px] text-ink-soft">{quota ? (quota.likes_unlimited ? 'Curtidas ilimitadas' : `${quota.likes_left} curtidas e ${quota.invites_left} convites hoje`) : ''}{profile.vip_until && new Date(profile.vip_until) > new Date() ? ' · VIP ativo' : ''}</span></span>{profile.vip_until && new Date(profile.vip_until) > new Date() && <Crown className="w-5 h-5 text-amber" />}<ChevronRight className="w-5 h-5 text-ink-mute" /></Link>
          <Link to="/termos" className="flex items-center gap-3 p-4 hover:bg-surface-low"><FileText className="w-5 h-5 text-primary" /><b className="flex-1">Termos de Uso</b><ChevronRight className="w-5 h-5 text-ink-mute" /></Link>
          <Link to="/privacidade" className="flex items-center gap-3 p-4 hover:bg-surface-low"><FileText className="w-5 h-5 text-primary" /><b className="flex-1">Política de Privacidade (LGPD)</b><ChevronRight className="w-5 h-5 text-ink-mute" /></Link>
        </Card>

        <Card className="p-5">
          <div className="font-display font-semibold text-[18px] flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Notificações</div>
          {!notes?.length ? <p className="text-[14px] text-ink-soft mt-2">Nenhuma notificação.</p> : (
            <ul className="mt-2 divide-y divide-surface-highest">{notes.slice(0, 8).map(n => (
              <li key={n.id} className="py-2.5"><b className="text-[14px]">{n.title}</b><p className="text-[13px] text-ink-soft">{n.body}</p><span className="text-[11px] text-ink-mute">{new Date(n.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></li>))}</ul>)}
        </Card>

        <Card className="p-5 divide-y divide-surface-highest">
          <div className="font-display font-semibold text-[18px] pb-2">Privacidade da conta</div>
          <Toggle on={profile.invisible} onChange={v => setFlag('invisible', v)} icon={EyeOff} title="Modo invisível" desc="Só quem você curtiu consegue ver seu perfil." />
          <Toggle on={profile.paused} onChange={v => setFlag('paused', v)} icon={PauseCircle} title="Pausar conta" desc="Sai do feed, mas mantém matches e conversas." />
          <div className="pt-4">
            <Button variant="danger" className="w-full" onClick={async () => { if (del < 1) return setDel(1); await api.deleteAccount() }}>
              <Trash2 className="w-5 h-5" />{del ? 'Toque de novo para excluir DEFINITIVAMENTE' : 'Excluir minha conta e dados (LGPD)'}
            </Button>
          </div>
        </Card>
      </main>

      {welcome && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-secondary/95 to-primary/95 flex flex-col items-center justify-center text-white text-center px-6" onClick={() => setWelcome(false)}>
          <PartyPopper className="w-20 h-20 animate-pop" />
          <h2 className="text-[34px] font-extrabold mt-4 animate-pop">Perfil verificado!</h2>
          <p className="mt-2 text-[17px] opacity-90 max-w-sm">Bem-vindo(a) ao ITAC LOVE, {profile.name}. Seu selo de verificado já aparece no seu perfil.</p>
          <Button variant="outline" className="mt-8 !text-primary" onClick={() => setWelcome(false)}>Começar</Button>
        </div>
      )}
    </div>
  )
}
