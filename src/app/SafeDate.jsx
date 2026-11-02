import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Check, Copy, HeartHandshake, LocateFixed, MapPin, Phone, Plus, ShieldAlert, Trash2, UserRound, EyeOff } from 'lucide-react'
import { Button, ErrorBox, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { api, isDemo } from '../lib/api'
import { useLive } from '../lib/hooks'
import { friendlyError } from '../lib/constants'

const pad = (n) => String(n).padStart(2, '0')
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const STATUS = {
  scheduled: ['Agendado', 'bg-primary-fixed text-primary'], checkin_sent: ['Aguardando check-in', 'bg-amber/20 text-amber-ink'],
  ok: ['Tudo bem ✓', 'bg-tertiary-fixed/50 text-tertiary'], help: ['Pediu ajuda — contatos avisados', 'bg-secondary text-white'],
  alerted: ['Sem resposta — contatos avisados', 'bg-secondary text-white'], cancelled: ['Cancelado', 'bg-surface-mid text-ink-soft'],
}

export default function SafeDate() {
  const { convId } = useParams()
  const nav = useNavigate()
  const { data: conv } = useLive(() => api.getConversation(convId), [convId])
  const { data: contacts, reload: reloadContacts } = useLive(() => api.listContacts())
  const { data: dates } = useLive(() => api.listSafeDates())
  const start = new Date(Date.now() + 3600e3); start.setMinutes(0)
  const [f, setF] = useState({ place: '', starts_at: localInput(start), ends_at: localInput(new Date(start.getTime() + 2 * 3600e3)) })
  const [c, setC] = useState({ name: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')

  async function addContact(e) {
    e.preventDefault(); setError('')
    const phone = c.phone.replace(/[^\d+]/g, '')
    if (!c.name.trim() || phone.length < 10) return setError('Informe nome e telefone com DDD.')
    await api.addContact(c.name.trim(), phone); setC({ name: '', phone: '' }); reloadContacts()
  }
  async function submit(quick) {
    setError('')
    const s = quick ? new Date(Date.now() - 60e3) : new Date(f.starts_at)
    const e = quick ? new Date(Date.now() + 60e3) : new Date(f.ends_at)
    if (!f.place.trim()) return setError('Informe o local do encontro.')
    setBusy(true)
    try {
      const sd = await api.createSafeDate({ partner_id: conv.other.id, conversation_id: convId, place: f.place.trim(), starts_at: s.toISOString(), ends_at: e.toISOString() })
      setCreated(sd)
    } catch (err) { setError(friendlyError(err)) } finally { setBusy(false) }
  }
  function share(id) {
    if (!navigator.geolocation) return setGeoMsg('Localização indisponível neste aparelho.')
    navigator.geolocation.getCurrentPosition(p => { api.shareLocation(id, p.coords.latitude, p.coords.longitude); setGeoMsg('Localização compartilhada ✓') }, () => setGeoMsg('Não foi possível obter a localização (permissão negada).'))
  }
  const shareText = created && conv ? `Vou encontrar ${conv.other.name} em ${created.place}, ${fmt(created.starts_at)}. Estou usando o Modo Encontro Seguro do ITAC LOVE.` : ''

  if (!conv || !contacts || !dates) return <Spinner />
  const mine = dates.filter(d => d.conversation_id === convId || d.partner_id === conv.other.id)

  return (
    <div className="max-w-xl mx-auto px-4 pt-3 pb-10 lg:pt-8">
      <button onClick={() => nav(`/app/conversas/${convId}`)} className="inline-flex items-center gap-1 text-ink-soft font-semibold"><ArrowLeft className="w-5 h-5" />Voltar ao chat</button>
      <div className="flex items-center gap-3 mt-3">
        <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center"><HeartHandshake className="w-7 h-7 text-primary" /></div>
        <div><h1 className="text-[26px] font-bold leading-tight">Encontro seguro</h1><p className="text-ink-soft text-[14px]">Seus contatos de confiança ficam sabendo onde você está.</p></div>
      </div>
      <p className="mt-3 rounded-xl bg-surface-mid px-4 py-2.5 text-[13px] text-ink-soft flex gap-2"><EyeOff className="w-4 h-4 shrink-0 mt-0.5" />{conv.other.name} <b>não</b> é avisado(a) de que o modo seguro foi ativado.</p>

      {created ? (
        <div className="mt-5 bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-tertiary font-bold"><Check className="w-5 h-5" />Encontro registrado</div>
          <p className="text-[14px] mt-2">Seus {contacts.length} contato(s) receberam por SMS/WhatsApp um link com local, horário e a foto de {conv.other.name}.{isDemo && ' (Na demonstração o envio é simulado.)'}</p>
          <p className="text-[14px] mt-2">No horário de término ({fmt(created.ends_at)}) vamos perguntar <b>"Está tudo bem?"</b>. Sem resposta em 30 minutos, ou se você tocar em "Preciso de ajuda", seus contatos são avisados com sua última localização.</p>
          <div className="mt-3 rounded-xl bg-surface-low p-3 text-[13px] select-text">{shareText}</div>
          <div className="flex gap-2 mt-3">
            <Button variant="soft" className="flex-1 !py-2.5" onClick={() => { navigator.clipboard?.writeText(shareText).then(() => setCopied(true)).catch(() => {}) }}><Copy className="w-4 h-4" />{copied ? 'Copiado' : 'Copiar texto'}</Button>
            <Button variant="ocean" className="flex-1 !py-2.5" onClick={() => share(created.id)}><LocateFixed className="w-4 h-4" />Enviar localização</Button>
          </div>
          {geoMsg && <p className="text-[13px] mt-2 text-ink-soft">{geoMsg}</p>}
        </div>
      ) : (<>
        <section className="mt-5 bg-card rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3"><PhotoImg path={conv.other.photos?.[0]} className="w-12 h-12 rounded-full object-cover" alt="" /><div><div className="text-[12px] text-ink-soft">Com quem você vai</div><b>{conv.other.name}, {conv.other.age}</b></div></div>
          <label className="block"><span className="label">Local</span>
            <div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" /><input id="sd-place" className="field pl-12" value={f.place} onChange={e => setF({ ...f, place: e.target.value })} placeholder="Ex.: Praça da Matriz, Itacarambi" /></div></label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className="label">Início</span><input id="sd-start" type="datetime-local" className="field" value={f.starts_at} onChange={e => setF({ ...f, starts_at: e.target.value })} /></label>
            <label className="block"><span className="label">Término previsto</span><input id="sd-end" type="datetime-local" className="field" value={f.ends_at} onChange={e => setF({ ...f, ends_at: e.target.value })} /></label>
          </div>
        </section>

        <section className="mt-4 bg-card rounded-2xl p-5 shadow-sm">
          <h2 className="font-display font-semibold text-[18px]">Contatos de confiança</h2>
          <p className="text-[13px] text-ink-soft">Recebem o link do encontro e os alertas por SMS ou WhatsApp.</p>
          <ul className="mt-3 space-y-2">{contacts.map(ct => (
            <li key={ct.id} className="flex items-center gap-3 rounded-xl bg-surface-low px-3 py-2.5"><UserRound className="w-5 h-5 text-primary" /><div className="flex-1"><b className="text-[14px]">{ct.name}</b><div className="text-[13px] text-ink-soft">{ct.phone}</div></div>
              <button onClick={() => api.removeContact(ct.id).then(reloadContacts)} aria-label={`Remover ${ct.name}`} className="p-2 text-secondary"><Trash2 className="w-4 h-4" /></button></li>))}</ul>
          <form onSubmit={addContact} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input id="ct-name" className="field !py-2.5" placeholder="Nome" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} />
            <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" /><input id="ct-phone" type="tel" className="field !py-2.5 pl-9" placeholder="(38) 99999-0000" value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} /></div>
            <button type="submit" aria-label="Adicionar contato" className="w-12 rounded-xl bg-primary text-white flex items-center justify-center"><Plus className="w-5 h-5" /></button>
          </form>
        </section>
        <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
        <Button variant="ocean" className="w-full mt-4" loading={busy} onClick={() => submit(false)}><CalendarClock className="w-5 h-5" />Marcar encontro seguro</Button>
        {isDemo && <button onClick={() => submit(true)} className="w-full mt-2 text-[13px] text-violet font-semibold underline">Teste rápido: encontro que termina em 1 minuto (demonstração)</button>}
      </>)}

      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft mb-2">Encontros com {conv.other.name}</h2>
          <ul className="space-y-2">{mine.map(d => (
            <li key={d.id} className="bg-card rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between gap-2"><b>{d.place}</b><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold h-fit ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span></div>
              <div className="text-[13px] text-ink-soft">{fmt(d.starts_at)} até {fmt(d.ends_at)}</div>
              {['scheduled', 'checkin_sent'].includes(d.status) && <div className="flex gap-2 mt-3">
                <Button variant="love" className="!py-2 flex-1" onClick={() => api.respondCheckin(d.id, false)}><ShieldAlert className="w-4 h-4" />Preciso de ajuda</Button>
                <Button variant="soft" className="!py-2" onClick={() => api.cancelSafeDate(d.id)}>Cancelar</Button></div>}
              {d.alert_log?.length > 0 && <div className="mt-3 rounded-xl bg-secondary-fixed/40 p-3 text-[12px] space-y-1"><b>Alertas enviados (simulação):</b>{d.alert_log.map((l, i) => <p key={i}>{l}</p>)}</div>}
            </li>))}</ul>
        </section>
      )}
    </div>
  )
}
