import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Heart, Info, Mail, MapPin, MessageCircle, SlidersHorizontal, X, Infinity as Inf, ShoppingBag, Flag, ShieldBan, Clock } from 'lucide-react'
import { Button, Chip, ErrorBox, Logo, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import ReportBlockSheet from '../components/ReportBlockSheet'
import { AffinityBadge, PhotoCarousel, ProfileDetails, TagList } from './ProfileView'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { useScreenProtection } from '../lib/protection'
import { LOOKING_FOR, SHOW_GENDERS, TAG_CATEGORIES, friendlyError } from '../lib/constants'
import { formatLeft, useNow, useTags } from '../lib/hooks'

const FKEY = 'itac_filters'
const loadFilters = () => { try { return JSON.parse(localStorage.getItem(FKEY)) || {} } catch { return {} } }
const saveFilters = (f) => { try { localStorage.setItem(FKEY, JSON.stringify(f)) } catch { /* sem storage */ } }

function QuotaChip({ q }) {
  if (!q) return null
  if (q.likes_unlimited) return <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed/60 px-3 py-1.5 text-[13px] font-bold text-secondary"><Heart className="w-4 h-4 fill-secondary" /><Inf className="w-4 h-4" />curtidas</span>
  const left = q.likes_left + (q.extra_likes || 0)
  return (
    <Link to="/app/loja" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold ${left ? 'bg-secondary-fixed/60 text-secondary' : 'bg-secondary text-white'}`} title="Curtidas restantes hoje">
      <Heart className="w-4 h-4" />{left} · <Mail className="w-4 h-4" />{q.invites_unlimited ? '∞' : q.invites_left + (q.extra_invites || 0)}
    </Link>
  )
}

function SwipeCard({ p, onDecide, onOpen, blurred }) {
  const [dx, setDx] = useState(0)
  const [drag, setDrag] = useState(false)
  const start = useRef(null)
  const down = (e) => { if (e.target.closest('button')) return; start.current = e.clientX; setDrag(true); e.currentTarget.setPointerCapture?.(e.pointerId) }
  const move = (e) => { if (start.current != null) setDx(e.clientX - start.current) }
  const up = () => {
    if (start.current == null) return
    const moved = Math.abs(dx) > 8
    start.current = null; setDrag(false)
    if (dx > 110) { setDx(600); setTimeout(() => onDecide('like'), 180) }
    else if (dx < -110) { setDx(-600); setTimeout(() => onDecide('pass'), 180) }
    else { setDx(0); if (!moved) onOpen() }
  }
  return (
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className="absolute inset-0 rounded-[28px] overflow-hidden shadow-2xl bg-card touch-pan-y cursor-grab active:cursor-grabbing"
      style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: drag ? 'none' : 'transform .25s ease' }}>
      <PhotoCarousel photos={p.photos} blurred={blurred} className="absolute inset-0" />
      <div className="absolute top-5 left-5 z-20 border-4 border-tertiary-green text-tertiary-green font-display font-extrabold text-[30px] px-3 rounded-xl rotate-[-14deg] bg-card/70" style={{ opacity: Math.max(0, Math.min(1, dx / 100)) }}>CURTIR</div>
      <div className="absolute top-5 right-5 z-20 border-4 border-secondary text-secondary font-display font-extrabold text-[30px] px-3 rounded-xl rotate-[14deg] bg-card/70" style={{ opacity: Math.max(0, Math.min(1, -dx / 100)) }}>PASSAR</div>
      <div className="absolute top-5 right-4 z-20" style={{ opacity: dx < -10 ? 0 : 1 }}><AffinityBadge value={p.affinity} /></div>
      <div className="absolute inset-x-0 bottom-0 z-20 p-5 pt-24 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white pointer-events-none">
        <div className="flex items-center gap-2"><h2 className="text-[30px] font-bold leading-none">{p.name}, {p.age}</h2>{p.verified && <BadgeCheck className="w-7 h-7 text-mint" aria-label="Verificado" />}</div>
        <div className="flex items-center gap-1 text-[14px] mt-1 opacity-90"><MapPin className="w-4 h-4" />{p.city}{p.distance_km != null ? ` · a ${p.distance_km} km` : ''}</div>
        <p className="text-[14px] mt-2 line-clamp-2 opacity-90">{p.bio}</p>
        <div className="mt-3"><TagList tags={p.tags} common={p.common_tags} max={5} /></div>
      </div>
      <button onClick={onOpen} aria-label="Ver perfil completo" className="absolute bottom-5 right-5 z-30 w-10 h-10 rounded-full bg-card/90 text-ink flex items-center justify-center"><Info className="w-5 h-5" /></button>
    </div>
  )
}

function FiltersSheet({ value, onApply, onClose }) {
  const tags = useTags()
  const [f, setF] = useState({ minAge: 18, maxAge: 60, maxKm: null, genders: [], looking: [], tags: [], ...value })
  const tog = (k, v) => setF(s => ({ ...s, [k]: s[k].includes(v) ? s[k].filter(x => x !== v) : [...s[k], v] }))
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col animate-pop" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-surface-highest"><h2 className="text-[20px] font-bold">Filtros</h2><button onClick={onClose} aria-label="Fechar"><X className="w-6 h-6" /></button></div>
        <div className="overflow-y-auto p-5 space-y-6">
          <section><span className="label">Idade: {f.minAge} a {f.maxAge} anos</span>
            <div className="grid grid-cols-2 gap-3">
              <input id="fminage" type="number" min={18} max={99} className="field" value={f.minAge} onChange={e => setF({ ...f, minAge: Math.max(18, +e.target.value || 18) })} aria-label="Idade mínima" />
              <input id="fmaxage" type="number" min={18} max={99} className="field" value={f.maxAge} onChange={e => setF({ ...f, maxAge: +e.target.value || 99 })} aria-label="Idade máxima" />
            </div></section>
          <section><span className="label">Distância máxima</span>
            <div className="flex flex-wrap gap-2">{[[5, '5 km'], [10, '10 km'], [25, '25 km'], [50, '50 km'], [100, '100 km'], [null, 'Sem limite']].map(([v, l]) => <Chip key={l} active={f.maxKm === v} onClick={() => setF({ ...f, maxKm: v })}>{l}</Chip>)}</div></section>
          <section><span className="label">Gênero <span className="font-normal text-[13px] text-ink-soft">(vazio = suas preferências do cadastro)</span></span>
            <div className="flex flex-wrap gap-2">{SHOW_GENDERS.map(g => <Chip key={g.id} active={f.genders.includes(g.id)} onClick={() => tog('genders', g.id)}>{g.id === 'nao_binarios' ? 'Não binários e outros' : g.label}</Chip>)}</div></section>
          <section><span className="label">O que está buscando</span>
            <div className="flex flex-wrap gap-2">{LOOKING_FOR.map(l => <Chip key={l.id} active={f.looking.includes(l.id)} onClick={() => tog('looking', l.id)}>{l.label}</Chip>)}</div></section>
          <section><span className="label">Interesses</span>
            {TAG_CATEGORIES.map(c => <div key={c.id} className="mb-3"><div className="text-[13px] font-bold text-ink-soft mb-1.5">{c.emoji} {c.label}</div>
              <div className="flex flex-wrap gap-1.5">{tags.filter(t => t.category === c.id).map(t => <Chip key={t.id} className="!px-3 !py-1.5 !text-[13px]" active={f.tags.includes(t.id)} onClick={() => tog('tags', t.id)}>{t.label}</Chip>)}</div></div>)}
          </section>
        </div>
        <div className="p-4 border-t border-surface-highest flex gap-2 safe-bottom">
          <Button variant="soft" className="flex-1" onClick={() => onApply({})}>Limpar</Button>
          <Button variant="ocean" className="flex-[2]" onClick={() => onApply(f)}>Aplicar filtros</Button>
        </div>
      </div>
    </div>
  )
}

export function MatchOverlay({ match, me, onClose }) {
  const nav = useNavigate()
  const now = useNow()
  if (!match) return null
  return (
    <div className="fixed inset-0 z-[55] bg-gradient-to-b from-secondary to-primary text-white flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => <Heart key={i} className="absolute fill-white/20 text-transparent animate-floaty" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: 20 + (i % 4) * 14, height: 20 + (i % 4) * 14, animationDelay: `${i * 0.2}s` }} />)}
      <h2 className="font-display text-[46px] font-extrabold animate-pop relative">Deu match!</h2>
      <p className="opacity-90 relative">Você e {match.other.name} se curtiram 💘</p>
      <div className="flex items-center mt-8 relative animate-pop">
        <PhotoImg path={me.photo} className="w-32 h-32 rounded-full object-cover border-4 border-white -rotate-6 shadow-xl" alt="" />
        <div className="w-14 h-14 -mx-4 z-10 rounded-full bg-card flex items-center justify-center shadow-lg"><Heart className="w-8 h-8 text-secondary fill-secondary" /></div>
        <PhotoImg path={match.other.photos?.[0]} className="w-32 h-32 rounded-full object-cover border-4 border-white rotate-6 shadow-xl" alt="" />
      </div>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 font-semibold relative"><Clock className="w-5 h-5" />O chat expira em {formatLeft(new Date(match.expires_at) - now)} se ninguém mandar mensagem</div>
      <Button variant="outline" className="mt-6 w-full max-w-xs !text-secondary relative" onClick={() => nav(`/app/conversas/${match.conversation_id}`)}><MessageCircle className="w-5 h-5" />Enviar mensagem</Button>
      <button className="mt-4 font-semibold opacity-90 relative" onClick={onClose}>Continuar descobrindo</button>
    </div>
  )
}

export default function Feed() {
  const { profile } = useSession()
  const [filters, setFilters] = useState(loadFilters)
  const [list, setList] = useState(null)
  const [q, setQ] = useState(null)
  const [open, setOpen] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [match, setMatch] = useState(null)
  const [invite, setInvite] = useState(null)
  const [inviteMsg, setInviteMsg] = useState('')
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [myPhoto, setMyPhoto] = useState(null)
  const [likedCount, setLikedCount] = useState(0)
  const blurred = useScreenProtection()

  const load = useCallback(async () => {
    try { setList(await api.getFeed(filters)) } catch (e) { setList([]); setError(friendlyError(e)) }
    api.quotaStatus().then(setQ).catch(() => {})
  }, [filters])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.getMyPhotos().then(p => setMyPhoto(p[0]?.path)); api.whoLikedMe().then(w => setLikedCount(w.count)).catch(() => {}) }, [])
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }

  const top = list?.[0]
  async function decide(kind, target = top) {
    if (!target) return
    setError('')
    try {
      const r = await api.like(target.id, kind)
      setList(l => l.filter(x => x.id !== target.id)); setQ(r.quota); setOpen(null)
      if (r.matched) setMatch(r)
    } catch (e) { setError(friendlyError(e)) }
  }
  async function sendInvite() {
    try {
      const r = await api.sendInvite(invite.id, inviteMsg); setQ(r.quota)
      setList(l => l.filter(x => x.id !== invite.id)); setInvite(null); setInviteMsg(''); setOpen(null)
      flash('Convite enviado! O chat abre se a pessoa aceitar.')
    } catch (e) { setError(friendlyError(e)); setInvite(null) }
  }
  useEffect(() => {
    const k = (e) => { if (open || invite || showFilters || match || /input|textarea/i.test(e.target.tagName)) return; if (e.key === 'ArrowRight') decide('like'); if (e.key === 'ArrowLeft') decide('pass') }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  })

  return (
    <div className="max-w-xl mx-auto px-4 pt-3 lg:pt-6">
      <header className="flex items-center justify-between gap-2">
        <Logo className="w-24 lg:hidden" /><h1 className="hidden lg:block text-[28px] font-bold">Descobrir</h1>
        <div className="flex items-center gap-2">
          <Link to="/app/curtidas" aria-label="Quem curtiu você" className="relative w-11 h-11 rounded-full bg-card shadow-sm flex items-center justify-center text-secondary"><Heart className="w-5 h-5 fill-secondary" />{likedCount > 0 && <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-violet text-white text-[11px] font-bold flex items-center justify-center">{likedCount > 9 ? '9+' : likedCount}</span>}</Link>
          <QuotaChip q={q} />
          <button onClick={() => setShowFilters(true)} aria-label="Filtros" className="relative w-11 h-11 rounded-full bg-card shadow-sm flex items-center justify-center"><SlidersHorizontal className="w-5 h-5" />{Object.values(filters).some(v => (Array.isArray(v) ? v.length : v)) && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-secondary" />}</button>
        </div>
      </header>
      {profile.paused && <div className="mt-3 rounded-xl bg-amber/20 text-amber-ink text-[14px] font-semibold px-4 py-2.5">Sua conta está pausada: você não aparece no feed nem pode curtir. <Link to="/app/perfil" className="underline">Reativar</Link></div>}
      {error && <div className="mt-3"><ErrorBox>{error}{/acabaram/.test(error) && <Link to="/app/loja" className="ml-1 underline">Comprar mais</Link>}</ErrorBox></div>}

      <div className="relative mt-3 h-[clamp(340px,calc(100dvh-300px-var(--sat)-var(--sab)),620px)] lg:h-[clamp(420px,calc(100dvh-230px),640px)]">
        {!list ? <Spinner /> : !top ? (
          <div className="absolute inset-0 rounded-[28px] border-2 border-dashed border-ink-line flex flex-col items-center justify-center text-center px-8">
            <Heart className="w-12 h-12 text-secondary" />
            <h2 className="text-[22px] font-bold mt-3">Você viu todo mundo por aqui</h2>
            <p className="text-ink-soft mt-1">Amplie os filtros ou volte mais tarde. Gente nova chega todo dia em Itacarambi e região.</p>
            <Button variant="ocean" className="mt-5" onClick={() => setShowFilters(true)}><SlidersHorizontal className="w-5 h-5" />Ajustar filtros</Button>
          </div>
        ) : (<>
          {list[1] && <div className="absolute inset-0 scale-[.95] translate-y-3 rounded-[28px] overflow-hidden opacity-70"><PhotoImg path={list[1].photos[0]} className="w-full h-full object-cover" alt="" /></div>}
          <SwipeCard key={top.id} p={top} blurred={blurred} onDecide={decide} onOpen={() => setOpen(top)} />
        </>)}
      </div>

      {top && (
        <div className="flex items-center justify-center gap-5 mt-4 pb-3">
          <button onClick={() => decide('pass')} aria-label="Passar" className="w-16 h-16 rounded-full bg-card shadow-lg text-secondary flex items-center justify-center active:scale-90 transition"><X className="w-8 h-8" strokeWidth={3} /></button>
          <button onClick={() => setInvite(top)} aria-label="Enviar convite" className="w-12 h-12 rounded-full bg-card shadow-lg text-violet flex items-center justify-center active:scale-90 transition"><Mail className="w-6 h-6" /></button>
          <button onClick={() => decide('like')} aria-label="Curtir" className="w-16 h-16 rounded-full bg-secondary shadow-lg shadow-secondary/30 text-white flex items-center justify-center active:scale-90 transition"><Heart className="w-8 h-8 fill-white" /></button>
        </div>
      )}
      <p className="hidden lg:block text-center text-[12px] text-ink-mute pb-6">Dica: arraste o cartão com o mouse ou use as setas ← → do teclado.</p>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setOpen(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-pop" onClick={e => e.stopPropagation()}>
            <ProfileDetails p={open} blurred={blurred} actions={<>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button variant="soft" onClick={() => decide('pass', open)}><X className="w-5 h-5" />Passar</Button>
                <Button variant="outline" onClick={() => setInvite(open)}><Mail className="w-5 h-5" />Convite</Button>
                <Button variant="love" onClick={() => decide('like', open)}><Heart className="w-5 h-5" />Curtir</Button>
              </div>
              <div className="flex justify-center gap-6 pt-2 text-[14px] font-semibold text-ink-soft">
                <button onClick={() => setSheet('report')} className="inline-flex items-center gap-1.5"><Flag className="w-4 h-4" />Denunciar</button>
                <button onClick={() => setSheet('block')} className="inline-flex items-center gap-1.5"><ShieldBan className="w-4 h-4" />Bloquear</button>
              </div>
            </>} />
          </div>
        </div>
      )}
      {invite && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setInvite(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
            <h2 className="text-[20px] font-bold flex items-center gap-2"><Mail className="w-5 h-5 text-violet" />Convite para {invite.name}</h2>
            <p className="text-[14px] text-ink-soft mt-1">Sem precisar de match: o chat abre se a pessoa aceitar.{q && !q.invites_unlimited && <> Você tem <b>{q.invites_left + (q.extra_invites || 0)}</b> convite(s) hoje.</>}</p>
            <textarea id="invite-msg" className="field mt-3" rows={3} maxLength={300} value={inviteMsg} onChange={e => setInviteMsg(e.target.value)} placeholder={`Oi, ${invite.name}! Vi que a gente curte…`} />
            <div className="flex gap-2 mt-4"><Button variant="soft" className="flex-1" onClick={() => setInvite(null)}>Cancelar</Button><Button variant="ocean" className="flex-[2]" onClick={sendInvite}>Enviar convite</Button></div>
          </div>
        </div>
      )}
      {showFilters && <FiltersSheet value={filters} onClose={() => setShowFilters(false)} onApply={(f) => { setFilters(f); saveFilters(f); setShowFilters(false) }} />}
      <MatchOverlay match={match} me={{ photo: myPhoto }} onClose={() => setMatch(null)} />
      <ReportBlockSheet mode={sheet} person={open} onClose={() => setSheet(null)} onBlocked={() => { setList(l => l.filter(x => x.id !== open?.id)); setOpen(null) }} />
      {toast && <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-night text-white px-5 py-3 text-[14px] font-semibold shadow-xl animate-pop">{toast}</div>}
      {q && !q.likes_unlimited && q.likes_left + (q.extra_likes || 0) === 0 && top && (
        <Link to="/app/loja" className="fixed bottom-24 lg:bottom-8 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-violet text-white px-4 py-3 font-semibold shadow-xl"><ShoppingBag className="w-5 h-5" />Mais curtidas</Link>
      )}
    </div>
  )
}
