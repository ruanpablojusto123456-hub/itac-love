import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BadgeCheck, Check, CheckCheck, Clock, EllipsisVertical, Flag, HeartHandshake, Send, ShieldBan, Smile, Timer, UserRound, X, EyeOff } from 'lucide-react'
import { Button, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import Watermark from '../components/Watermark'
import ReportBlockSheet from '../components/ReportBlockSheet'
import { ProfileDetails } from './ProfileView'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { blockCopy, useScreenProtection } from '../lib/protection'
import { SELF_DESTRUCT, friendlyError, isScam } from '../lib/constants'
import { formatLeft, useLive, useNow } from '../lib/hooks'

const EMOJIS = '😀 😂 🥰 😍 😘 😊 😉 😎 🤩 🥳 😅 🤗 🤔 😴 😢 😭 😡 👍 👏 🙏 💪 👋 🙌 ❤️ 💙 💖 💘 🔥 ✨ 🌹 🌻 🌞 🌙 🎉 🎶 🍕 🍔 🍺 ☕ 🍫 ⚽ 🐶 🐱 🌊 🏖️ 🚴'.split(' ')
const dkey = (id) => 'itac_sd_prompt_' + id

export default function Chat({ id }) {
  const { profile } = useSession()
  const nav = useNavigate()
  const now = useNow(1000)
  const { data: conv, error: convErr } = useLive(() => api.getConversation(id), [id])
  const { data: msgs } = useLive(() => api.listMessages(id), [id])
  const [words, setWords] = useState([])
  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState(false)
  const [menu, setMenu] = useState(false)
  const [sdOpen, setSdOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [preset, setPreset] = useState(null)
  const [viewProfile, setViewProfile] = useState(false)
  const [error, setError] = useState('')
  const [promptDismissed, setPromptDismissed] = useState(() => { try { return !!localStorage.getItem(dkey(id)) } catch { return false } })
  const end = useRef(null)
  const blurred = useScreenProtection(() => api.reportScreenshot(id).catch(() => {}))

  useEffect(() => { api.getSettings().then(s => setWords(s.scam_words || [])).catch(() => {}) }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs?.length])
  useEffect(() => { if (msgs?.some(m => m.sender_id && m.sender_id !== profile.id && !m.read_at) && document.hasFocus()) api.markRead(id).catch(() => {}) }, [msgs, id, profile.id])

  if (convErr) return <div className="p-8 text-center text-ink-soft">Conversa não encontrada. <Link to="/app/conversas" className="text-primary underline">Voltar</Link></div>
  if (!conv || !msgs) return <div className="flex-1"><Spinner /></div>
  const o = conv.other
  const closed = !!conv.closed_at || conv.match?.status === 'expired' || conv.match?.status === 'closed'
  const expiring = conv.match && !conv.match.first_message_at && conv.match.status === 'active'
  const hasText = msgs.some(m => m.kind === 'text')
  const sdLabel = SELF_DESTRUCT.find(s => s.secs === (conv.self_destruct_seconds || null))?.label

  async function send(e) {
    e?.preventDefault(); const t = text.trim(); if (!t) return
    setText(''); setEmoji(false); setError('')
    try { await api.sendMessage(id, t) } catch (err) { setError(friendlyError(err)); setText(t) }
  }
  async function setSD(secs) {
    setSdOpen(false); setMenu(false); dismissPrompt()
    try { await api.setSelfDestruct(id, secs) } catch (err) { setError(friendlyError(err)) }
  }
  function dismissPrompt() { setPromptDismissed(true); try { localStorage.setItem(dkey(id), '1') } catch { /* sem storage */ } }

  return (
    <div className="flex flex-col h-[100dvh] lg:h-screen w-full bg-surface-low">
      {/* Cabeçalho */}
      <header className="flex items-center gap-2 px-2 py-2 bg-white border-b border-surface-highest">
        <button onClick={() => nav('/app/conversas')} aria-label="Voltar" className="p-2 rounded-full hover:bg-surface-low lg:hidden"><ArrowLeft className="w-6 h-6" /></button>
        <button onClick={() => setViewProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left pl-1">
          <PhotoImg path={o.photos?.[0]} className={`w-11 h-11 rounded-full object-cover no-select ${blurred ? 'blur-md' : ''}`} alt="" />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-display font-semibold text-[17px]"><span className="truncate">{o.name}</span>{o.verified && <BadgeCheck className="w-5 h-5 text-tertiary shrink-0" />}</div>
            <div className="text-[12px] text-ink-soft flex items-center gap-1">{conv.self_destruct_seconds ? <><Timer className="w-3.5 h-3.5 text-violet" />Autodestruição: {sdLabel}</> : 'Toque para ver o perfil'}</div>
          </div>
        </button>
        <button onClick={() => setMenu(true)} aria-label="Opções da conversa" className="p-2 rounded-full hover:bg-surface-low"><EllipsisVertical className="w-6 h-6" /></button>
      </header>

      {expiring && !closed && (
        <div className="bg-secondary-fixed/60 text-secondary text-[13px] font-semibold px-4 py-2 flex items-center justify-center gap-2"><Clock className="w-4 h-4" />Match expira em {formatLeft(new Date(conv.match.expires_at) - now)} se ninguém mandar mensagem</div>
      )}

      {/* Mensagens (protegidas: marca d'água, borrão e sem cópia) */}
      <div className="relative flex-1 overflow-hidden" {...blockCopy}>
        <Watermark name={profile.name} id={profile.id} />
        {blurred && <div className="absolute inset-0 z-20 backdrop-blur-xl bg-white/40 flex flex-col items-center justify-center text-ink-soft font-semibold"><EyeOff className="w-8 h-8 mb-2" />Conteúdo protegido</div>}
        <div className="h-full overflow-y-auto px-3 py-4 space-y-2 no-select">
          {!hasText && !conv.self_destruct_seconds && !promptDismissed && !closed && (
            <div className="mx-auto max-w-sm bg-white rounded-2xl p-4 shadow-sm text-center">
              <Timer className="w-7 h-7 text-violet mx-auto" />
              <div className="font-display font-semibold mt-1">Ativar autodestruição das mensagens?</div>
              <p className="text-[13px] text-ink-soft">As mensagens somem do aparelho e do servidor depois do tempo escolhido. Qualquer um dos dois pode mudar depois.</p>
              <div className="grid grid-cols-3 gap-2 mt-3">{SELF_DESTRUCT.filter(s => s.secs).map(s => <button key={s.secs} onClick={() => setSD(s.secs)} className="rounded-xl bg-violet/10 text-violet font-semibold py-2 text-[14px]">{s.label}</button>)}</div>
              <button onClick={dismissPrompt} className="mt-2 text-[13px] text-ink-soft underline">Agora não</button>
            </div>
          )}
          {msgs.map(m => {
            if (m.kind === 'system') return <div key={m.id} className="flex justify-center"><span className="max-w-[85%] text-center rounded-full bg-ink/5 text-ink-soft text-[12px] font-semibold px-3 py-1.5">{m.body}</span></div>
            const mine = m.sender_id === profile.id
            const scam = !mine && isScam(m.body, words)
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words ${mine ? 'bg-primary text-white rounded-br-md' : 'bg-white text-ink rounded-bl-md shadow-sm'}`}>
                  {m.body}
                  <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${mine ? 'text-white/75' : 'text-ink-mute'}`}>
                    {m.expires_at && <><Timer className="w-3 h-3" />{formatLeft(new Date(m.expires_at) - now)} ·</>}
                    {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {mine && (m.read_at ? <CheckCheck className="w-3.5 h-3.5 text-tertiary-fixed" aria-label="Lida" /> : <Check className="w-3.5 h-3.5" aria-label="Enviada" />)}
                  </span>
                </div>
                {scam && (
                  <div className="max-w-[80%] mt-1 rounded-xl bg-amber/15 border border-amber/40 px-3 py-2 text-[12px] text-[#7a4d00] flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Cuidado: nunca envie dinheiro para quem você não conhece pessoalmente. <button onClick={() => { setPreset('golpe'); setSheet('report') }} className="font-bold underline">Denunciar</button></span>
                  </div>
                )}
              </div>)
          })}
          <div ref={end} />
        </div>
      </div>

      {/* Envio */}
      {closed ? (
        <div className="p-4 bg-white text-center text-ink-soft text-[14px] safe-bottom">Esta conversa foi encerrada.</div>
      ) : (
        <form onSubmit={send} className="relative bg-white border-t border-surface-highest p-2 flex items-end gap-2 safe-bottom">
          {emoji && (
            <div className="absolute bottom-full left-2 mb-2 w-72 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl p-2 grid grid-cols-8 gap-1 z-30">
              {EMOJIS.map(e => <button type="button" key={e} onClick={() => setText(t => t + e)} className="text-[22px] rounded-lg hover:bg-surface-low aspect-square">{e}</button>)}
            </div>
          )}
          <button type="button" onClick={() => setEmoji(!emoji)} aria-label="Emojis" className={`p-2.5 rounded-full ${emoji ? 'bg-surface-mid text-primary' : 'text-ink-soft'}`}><Smile className="w-6 h-6" /></button>
          <textarea id="chat-input" rows={1} value={text} maxLength={2000} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escreva uma mensagem…" className="flex-1 resize-none rounded-2xl bg-surface-low px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 max-h-32" />
          <button type="submit" disabled={!text.trim()} aria-label="Enviar" className="w-11 h-11 rounded-full bg-secondary text-white flex items-center justify-center disabled:opacity-40"><Send className="w-5 h-5" /></button>
          {error && <div className="absolute bottom-full right-2 mb-2 rounded-xl bg-secondary text-white text-[13px] px-3 py-2">{error}</div>}
        </form>
      )}

      {/* Menu */}
      {menu && (
        <div className="fixed inset-0 z-40 bg-ink/40 flex items-end sm:items-center justify-center" onClick={() => setMenu(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-3 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
            {[[HeartHandshake, 'Marcar encontro seguro', () => nav(`/app/encontro/${id}`), 'text-primary'],
              [Timer, `Autodestruição (${sdLabel})`, () => { setMenu(false); setSdOpen(true) }, 'text-violet'],
              [UserRound, 'Ver perfil', () => { setMenu(false); setViewProfile(true) }, 'text-ink'],
              [Flag, 'Denunciar', () => { setMenu(false); setPreset(null); setSheet('report') }, 'text-secondary'],
              [ShieldBan, 'Bloquear', () => { setMenu(false); setSheet('block') }, 'text-secondary']].map(([I, l, fn, c]) => (
              <button key={l} onClick={fn} disabled={closed && l !== 'Ver perfil' && l !== 'Denunciar'} className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-surface-low text-left font-semibold disabled:opacity-40"><I className={`w-5 h-5 ${c}`} />{l}</button>))}
          </div>
        </div>
      )}
      {sdOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 flex items-end sm:items-center justify-center" onClick={() => setSdOpen(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h2 className="text-[20px] font-bold">Autodestruição</h2><button onClick={() => setSdOpen(false)} aria-label="Fechar"><X className="w-6 h-6" /></button></div>
            <p className="text-[13px] text-ink-soft mt-1">Vale para as próximas mensagens. O chat avisa a outra pessoa da mudança.</p>
            <div className="mt-3 space-y-2">{SELF_DESTRUCT.map(s => (
              <button key={String(s.secs)} onClick={() => setSD(s.secs)} className={`w-full flex justify-between items-center rounded-xl border p-3.5 font-semibold ${(conv.self_destruct_seconds || null) === s.secs ? 'border-violet bg-violet/10 text-violet' : 'border-ink-line/50'}`}>{s.label}{(conv.self_destruct_seconds || null) === s.secs && <Check className="w-5 h-5" />}</button>))}</div>
          </div>
        </div>
      )}
      {viewProfile && (
        <div className="fixed inset-0 z-40 bg-ink/50 flex items-end sm:items-center justify-center" onClick={() => setViewProfile(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-pop" onClick={e => e.stopPropagation()}>
            <ProfileDetails p={o} blurred={blurred} actions={<Button variant="soft" className="w-full" onClick={() => setViewProfile(false)}>Fechar</Button>} />
          </div>
        </div>
      )}
      <ReportBlockSheet mode={sheet} person={o} conversationId={id} preset={preset} onClose={() => setSheet(null)} onBlocked={() => nav('/app/conversas')} />
    </div>
  )
}
