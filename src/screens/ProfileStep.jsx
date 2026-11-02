import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Calendar, Compass, Crosshair, Flame, Heart, IdCard, Info, MapPin, ShieldAlert, Users, Check } from 'lucide-react'
import { BottomBar, Button, Chip, ErrorBox, StepHeader } from '../components/ui'
import LegalModal from '../components/LegalModal'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { GENDERS, LOOKING_FOR, ORIENTATIONS, SHOW_GENDERS, ageFrom, friendlyError } from '../lib/constants'

const ICONS = { Heart, Flame, Users, Compass }

export default function ProfileStep() {
  const { profile, refresh } = useSession()
  const nav = useNavigate()
  const [f, setF] = useState(() => ({
    name: profile.name || '', birth_date: profile.birth_date || '', city: profile.city || 'Itacarambi, MG',
    lat: profile.lat, lng: profile.lng, gender_identity: profile.gender_identity || '', gender_other: profile.gender_other || '',
    orientation: profile.orientation || '', show_genders: profile.show_genders || [], looking_for: profile.looking_for || '', bio: profile.bio || '',
  }))
  const [agree, setAgree] = useState(!!profile.terms_accepted_at)
  const [legal, setLegal] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [geo, setGeo] = useState(profile.lat ? 'ok' : '')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const locked = profile.verified
  const age = ageFrom(f.birth_date)
  const maxDate = new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10)

  function toggleShow(id) {
    if (id === 'todos') return set('show_genders', f.show_genders.length === 3 ? [] : SHOW_GENDERS.map(g => g.id))
    set('show_genders', f.show_genders.includes(id) ? f.show_genders.filter(x => x !== id) : [...f.show_genders, id])
  }
  function locate() {
    if (!navigator.geolocation) return setGeo('erro')
    setGeo('buscando')
    navigator.geolocation.getCurrentPosition(
      p => { set('lat', p.coords.latitude); set('lng', p.coords.longitude); setGeo('ok') },
      () => setGeo('erro'), { enableHighAccuracy: false, timeout: 10000 })
  }

  async function next() {
    setError('')
    if (f.name.trim().length < 2) return setError('Informe como quer ser chamado(a).')
    if (!f.birth_date) return setError('Informe sua data de nascimento.')
    if (age < 18) return setError('O ITAC LOVE é exclusivo para maiores de 18 anos.')
    if (!f.city.trim()) return setError('Informe sua cidade.')
    if (!f.gender_identity) return setError('Escolha sua identidade de gênero.')
    if (f.gender_identity === 'outro' && !f.gender_other.trim()) return setError('Descreva sua identidade de gênero.')
    if (!f.orientation) return setError('Escolha sua orientação sexual.')
    if (!f.show_genders.length) return setError('Escolha quem você quer ver no feed.')
    if (!f.looking_for) return setError('Conte o que você está buscando.')
    if (f.bio.trim().length < 10) return setError('Escreva uma bio curta (pelo menos 10 caracteres).')
    if (!agree) return setError('Para continuar, aceite os Termos de Uso e a Política de Privacidade.')
    setSaving(true)
    try {
      await api.updateProfile({ ...f, name: f.name.trim(), bio: f.bio.trim(), city: f.city.trim() })
      if (!profile.terms_accepted_at) await api.acceptTerms()
      await refresh(); nav('/cadastro/fotos')
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  return (
    <div className="pb-32">
      <StepHeader step={1} title="Seu perfil" subtitle="Sobre você · 25%" />
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-7">
        {profile.status === 'rejected' && (
          <div className="rounded-2xl bg-secondary-fixed/50 p-4 text-[14px]"><b className="text-secondary">Sua verificação anterior foi reprovada:</b> {profile.rejection_reason}<br />Revise seus dados, fotos e envie uma nova selfie.</div>
        )}
        <div className="rounded-2xl bg-surface-low p-4 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-xl bg-secondary-fixed/70 flex items-center justify-center shrink-0"><Heart className="w-6 h-6 text-secondary" /></div>
          <div><div className="font-display font-semibold text-[18px]">Crie conexões autênticas</div><p className="text-[14px] text-ink-soft">Seja você mesmo(a), sem filtros. Leva uns 3 minutinhos.</p></div>
        </div>

        <section>
          <div className="flex justify-between"><label className="label" htmlFor="name">Como quer ser chamado(a)?</label><span className="text-secondary text-[12px] font-bold">*Obrigatório</span></div>
          <div className="relative"><IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" />
            <input id="name" disabled={locked} value={f.name} maxLength={40} onChange={e => set('name', e.target.value)} placeholder="Ex.: Lucas Santos ou Mah" className="field pl-12 disabled:opacity-60" /></div>
          <p className="text-[12px] text-ink-soft mt-1.5">Este nome aparece em destaque no seu cartão.</p>
        </section>

        <section>
          <div className="flex justify-between"><label className="label" htmlFor="birth">Data de nascimento</label><span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed/60 text-secondary text-[12px] font-bold px-2 py-0.5 h-fit"><ShieldAlert className="w-3.5 h-3.5" />+18 Obrigatório</span></div>
          <div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute pointer-events-none" />
            <input id="birth" type="date" disabled={locked} max={maxDate} min="1920-01-01" value={f.birth_date} onChange={e => set('birth_date', e.target.value)} className="field pl-12 disabled:opacity-60" /></div>
          {f.birth_date && age < 18
            ? <p className="mt-2 rounded-xl bg-secondary-fixed/60 text-secondary text-[13px] font-semibold px-3 py-2">Desculpe, o ITAC LOVE é exclusivo para maiores de 18 anos.</p>
            : <p className="mt-2 rounded-xl bg-tertiary-fixed/30 text-tertiary text-[13px] px-3 py-2 flex gap-2"><Info className="w-4 h-4 shrink-0 mt-0.5" />Exibimos apenas sua idade{age ? ` (${age} anos)` : ''}, nunca a data completa.</p>}
        </section>

        <section>
          <label className="label" htmlFor="city">Sua cidade</label>
          <div className="flex gap-2">
            <div className="relative flex-1"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" />
              <input id="city" value={f.city} maxLength={60} onChange={e => set('city', e.target.value)} placeholder="Itacarambi, MG" className="field pl-12" /></div>
            <button type="button" onClick={locate} aria-label="Usar minha localização" className={`w-14 rounded-xl flex items-center justify-center transition ${geo === 'ok' ? 'bg-tertiary text-white' : 'bg-primary-fixed text-primary'}`}>{geo === 'ok' ? <Check className="w-6 h-6" /> : <Crosshair className={`w-6 h-6 ${geo === 'buscando' ? 'animate-spin' : ''}`} />}</button>
          </div>
          <p className="text-[12px] text-ink-soft mt-1.5">{geo === 'ok' ? 'Localização aproximada salva — usada só para calcular a distância.' : geo === 'erro' ? 'Não foi possível obter a localização. Tudo bem, a cidade já basta.' : 'Toque no alvo para usar a localização e ver a distância até as pessoas.'}</p>
        </section>

        <section>
          <div className="flex justify-between"><span className="label">Identidade de gênero</span><span className="text-[12px] text-ink-soft">Escolha 1</span></div>
          <div className="flex flex-wrap gap-2">{GENDERS.map(g => <Chip key={g.id} active={f.gender_identity === g.id} onClick={() => set('gender_identity', g.id)}>{g.label}</Chip>)}</div>
          {f.gender_identity === 'outro' && <input autoFocus value={f.gender_other} maxLength={40} onChange={e => set('gender_other', e.target.value)} placeholder="Como você se identifica?" className="field mt-3" />}
        </section>

        <section>
          <label className="label" htmlFor="ori">Orientação sexual</label>
          <select id="ori" value={f.orientation} onChange={e => set('orientation', e.target.value)} className="field appearance-none">
            <option value="">Selecione…</option>{ORIENTATIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </section>

        <section>
          <div className="flex justify-between"><span className="label">Quem você quer ver no feed?</span><span className="text-[12px] font-bold text-primary">Múltipla escolha</span></div>
          <div className="grid grid-cols-2 gap-2.5">
            {[...SHOW_GENDERS, { id: 'todos', label: 'Todos os gêneros' }].map(g => {
              const on = g.id === 'todos' ? f.show_genders.length === 3 : f.show_genders.includes(g.id)
              return (
                <button key={g.id} type="button" onClick={() => toggleShow(g.id)} aria-pressed={on}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left text-[14px] font-semibold transition ${on ? 'border-primary bg-primary-fixed/40' : 'border-ink-line/50 bg-card'}`}>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${on ? 'bg-primary text-white' : 'border-2 border-ink-line'}`}>{on && <Check className="w-4 h-4" />}</span>{g.label}
                </button>)
            })}
          </div>
        </section>

        <section>
          <span className="label">O que você está buscando agora?</span>
          <div className="grid grid-cols-2 gap-2.5">
            {LOOKING_FOR.map(l => { const I = ICONS[l.icon]; const on = f.looking_for === l.id
              return (
                <button key={l.id} type="button" onClick={() => set('looking_for', l.id)} aria-pressed={on}
                  className={`rounded-2xl p-4 text-left transition border-2 ${on ? 'bg-secondary-fixed/70 border-secondary/40 shadow-md' : 'bg-card border-transparent shadow-sm'}`}>
                  <I className={`w-6 h-6 ${on ? 'text-secondary' : 'text-primary'}`} />
                  <div className="mt-2 font-display font-semibold text-[17px] leading-tight">{l.label}</div>
                  <div className="text-[13px] text-ink-soft mt-0.5">{l.desc}</div>
                </button>) })}
          </div>
        </section>

        <section>
          <div className="flex justify-between"><label className="label" htmlFor="bio">Bio curta</label><span className="text-[12px] text-ink-soft">{f.bio.length} / 500</span></div>
          <textarea id="bio" rows={4} maxLength={500} value={f.bio} onChange={e => set('bio', e.target.value)} placeholder="Ex.: Apaixonado(a) pelo pôr do sol no Velho Chico, forró no fim de semana e um bom café…" className="field resize-none" />
          <p className="text-[12px] text-ink-soft mt-1.5">Dica: conte um hobby ou seu cantinho preferido da região.</p>
        </section>

        <section className="rounded-2xl bg-surface-low p-4">
          <div className="flex gap-3"><ShieldAlert className="w-6 h-6 text-secondary shrink-0" />
            <div><div className="font-semibold">Segurança da comunidade e antifraude</div><p className="text-[13px] text-ink-soft">Perfis falsos, uso de fotos ou documentos de terceiros, golpes ou falsidade de informações resultam em <b>banimento permanente</b>.</p></div></div>
          <label className="flex gap-3 mt-4 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="w-6 h-6 accent-primary shrink-0 mt-0.5" />
            <span className="text-[14px]">Declaro que sou maior de 18 anos e aceito os <button type="button" onClick={() => setLegal('termos')} className="text-primary underline font-semibold">Termos de Uso</button> e a <button type="button" onClick={() => setLegal('privacidade')} className="text-primary underline font-semibold">Política de Privacidade</button> (LGPD) do ITAC LOVE.</span>
          </label>
        </section>
        <ErrorBox>{error}</ErrorBox>
      </main>
      <BottomBar><Button onClick={next} loading={saving} className="w-full">Continuar para Fotos<ArrowRight className="w-5 h-5" /></Button></BottomBar>
      <LegalModal which={legal} onClose={() => setLegal(null)} />
    </div>
  )
}
