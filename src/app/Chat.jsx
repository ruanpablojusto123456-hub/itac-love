import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowLeft, BadgeCheck, Check, Clock, CornerUpLeft, EllipsisVertical, Flag, HeartHandshake, Send, ShieldBan, Smile, Timer, UserRound, X, EyeOff } from 'lucide-react'
import { Button, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import Watermark from '../components/Watermark'
import ReportBlockSheet from '../components/ReportBlockSheet'
import { ProfileDetails } from './ProfileView'
import { useChatMedia } from './ChatMedia'
import MessageBubble, { Countdown, MessageMenu, snippet } from './MessageBubble'
import { useChatMessages } from './useChatMessages'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { blockCopy, useScreenProtection } from '../lib/protection'
import { SELF_DESTRUCT, friendlyError, isScam } from '../lib/constants'
import { useLive } from '../lib/hooks'

const EMOJIS = '😀 😂 🥰 😍 😘 😊 😉 😎 🤩 🥳 😅 🤗 🤔 😴 😢 😭 😡 👍 👏 🙏 💪 👋 🙌 ❤️ 💙 💖 💘 🔥 ✨ 🌹 🌻 🌞 🌙 🎉 🎶 🍕 🍔 🍺 ☕ 🍫 ⚽ 🐶 🐱 🌊 🏖️ 🚴'.split(' ')
const dkey = (id) => 'itac_sd_prompt_' + id

export default function Chat({ id }) {
  const { profile } = useSession()
  const nav = useNavigate()
  const { data: conv, error: convErr } = useLive(() => api.getConversation(id), [id])
  const { msgs, send: sendMsg, remove } = useChatMessages(id, profile.id)
  const [words, setWords] = useState([])
  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState(false)
  const [menu, setMenu] = useState(false)
  const [sdOpen, setSdOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [preset, setPreset] = useState(null)
  const [viewProfile, setViewProfile] = useState(false)
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [msgMenu, setMsgMenu] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const [showDown, setShowDown] = useState(false)
  const [promptDismissed, setPromptDismissed] = useState(() => { try { return !!localStorage.getItem(dkey(id)) } catch { return false } })
  const scroller = useRef(null)
  const inputRef = useRef(null)
  const firstScroll = useRef(true)
  const replyRef = useRef(null); replyRef.current = replyTo
  const blurred = useScreenProtection(() => api.reportScreenshot(id).catch(() => {}))
  const media = useChatMedia(id, setError, () => replyRef.current?.id, () => setReplyTo(null))

  useEffect(() => { api.getSettings().then(s => setWords(s.scam_words || [])).catch(() => {}) }, [])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t) } }, [error])

  // Rolagem: na abertura vai direto ao fim; depois só desce sozinho se você já estiver perto do fim
  const nearBottom = () => { const el = scroller.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160 }
  const toBottom = (smooth) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }) }
  const lastMsg = msgs?.[msgs.length - 1]
  useLayoutEffect(() => {
    if (!msgs) return
    if (firstScroll.current) { firstScroll.current = false; toBottom(false); return }
    if (lastMsg?.sender_id === profile.id || nearBottom()) toBottom(true); else setShowDown(true)
  }, [msgs?.length, lastMsg?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Marca como lida quando chegam mensagens e o app está visível
  const unreadIncoming = msgs?.some(m => m.sender_id && m.sender_id !== profile.id && !m.read_at && !m._pending)
  useEffect(() => {
    if (!unreadIncoming) return
    const mark = () => { if (!document.hidden) api.markRead(id).catch(() => {}) }
    mark(); document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [unreadIncoming, id])

  const byId = useMemo(() => new Map((msgs || []).map(m => [m.id, m])), [msgs])
  const onReply = useCallback((m) => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 50) }, [])
  const onMenu = useCallback((m) => setMsgMenu(m), [])
  const jumpTo = useCallback((mid) => {
    const el = document.getElementById(`msg-${mid}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlight(mid)
    setTimeout(() => setHighlight(h => (h === mid ? null : h)), 1600)
  }, [])
  const onReport = useCallback(() => { setPreset('golpe'); setSheet('report') }, [])

  if (convErr) return <div className="p-8 text-center text-ink-soft">Conversa não encontrada. <Link to="/app/conversas" className="text-primary underline">Voltar</Link></div>
  if (!conv || !msgs) return <div className="flex-1"><Spinner /></div>
  const o = conv.other
  const closed = !!conv.closed_at || conv.match?.status === 'expired' || conv.match?.status === 'closed'
  const expiring = conv.match && !conv.match.first_message_at && conv.match.status === 'active'
  const hasText = msgs.some(m => m.kind === 'text')
  const sdLabel = SELF_DESTRUCT.find(s => s.secs === (conv.self_destruct_seconds || null))?.label
  const authorOf = (m) => (!m ? '' : m.sender_id === profile.id ? 'Você' : o.name)

  async function send(e) {
    e?.preventDefault(); const t = text.trim(); if (!t) return
    const r = replyTo?.id || null
    setText(''); setEmoji(false); setError(''); setReplyTo(null)
    inputRef.current?.focus()
    try { await sendMsg(t, r) } catch (err) { setError(friendlyError(err)); setText(t) }
  }
  async function del(m, forAll) { try { await remove(m, forAll) } catch (err) { setError(friendlyError(err)) } }
  async function setSD(secs) {
    setSdOpen(false); setMenu(false); dismissPrompt()
    try { await api.setSelfDestruct(id, secs) } catch (err) { setError(friendlyError(err)) }
  }
  function dismissPrompt() { setPromptDismissed(true); try { localStorage.setItem(dkey(id), '1') } catch { /* sem storage */ } }

  return (
    <div className="flex flex-col h-screen-safe lg:h-screen w-full bg-surface-low">
      {/* Cabeçalho (fica abaixo da câmera frontal / barra de status) */}
      <header className="flex items-center gap-2 px-2 py-2 bg-card border-b border-surface-highest shrink-0">
        <button onClick={() => nav('/app/conversas')} aria-label="Voltar" className="p-2 rounded-full hover:bg-surface-low lg:hidden"><ArrowLeft className="w-6 h-6" /></button>
        <button onClick={() => setViewProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left pl-1">
          <PhotoImg path={o.photos?.[0]} className={`w-11 h-11 rounded-full object-cover no-select shrink-0 ${blurred ? 'blur-md' : ''}`} alt="" />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-display font-semibold text-[17px]"><span className="truncate">{o.name}</span>{o.verified && <BadgeCheck className="w-5 h-5 text-tertiary shrink-0" />}</div>
            <div className="text-[12px] text-ink-soft flex items-center gap-1">{conv.self_destruct_seconds ? <><Timer className="w-3.5 h-3.5 text-violet" />Autodestruição: {sdLabel}</> : 'Toque para ver o perfil'}</div>
          </div>
        </button>
        <button onClick={() => setMenu(true)} aria-label="Opções da conversa" className="p-2 rounded-full hover:bg-surface-low"><EllipsisVertical className="w-6 h-6" /></button>
      </header>

      {expiring && !closed && (
        <div className="bg-secondary-fixed/60 text-secondary text-[13px] font-semibold px-4 py-2 flex items-center justify-center gap-2 shrink-0"><Clock className="w-4 h-4" />Match expira em <Countdown to={conv.match.expires_at} /> se ninguém mandar mensagem</div>
      )}

      {/* Mensagens (protegidas: marca d'água, borrão e sem cópia) */}
      <div className="relative flex-1 min-h-0" {...blockCopy}>
        <Watermark name={profile.name} id={profile.id} />
        {blurred && <div className="absolute inset-0 z-20 backdrop-blur-xl bg-surface/40 flex flex-col items-center justify-center text-ink-soft font-semibold"><EyeOff className="w-8 h-8 mb-2" />Conteúdo protegido</div>}
        <div ref={scroller} onScroll={() => { if (showDown && nearBottom()) setShowDown(false) }}
          className="h-full overflow-y-auto overscroll-contain px-3 py-4 space-y-2 no-select" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!hasText && !conv.self_destruct_seconds && !promptDismissed && !closed && (
            <div className="mx-auto max-w-sm bg-card rounded-2xl p-4 shadow-sm text-center">
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
            const q = m.reply_to ? (byId.get(m.reply_to) || null) : undefined
            return (
              <MessageBubble key={m.id} m={m} mine={mine} viewer={profile} blurred={blurred}
                quoted={q} quotedAuthor={q === null ? '' : authorOf(q)}
                scam={!mine && !m.media_type && isScam(m.body, words)} highlight={highlight === m.id}
                onReply={onReply} onMenu={onMenu} onJump={m.reply_to ? () => jumpTo(m.reply_to) : undefined} onReport={onReport} />
            )
          })}
        </div>
        {showDown && (
          <button onClick={() => { toBottom(true); setShowDown(false) }} aria-label="Ir para as mensagens novas" className="absolute right-3 bottom-3 z-20 w-11 h-11 rounded-full bg-card shadow-lg flex items-center justify-center text-primary"><ArrowDown className="w-5 h-5" /></button>
        )}
      </div>

      {/* Envio */}
      {closed ? (
        <div className="p-4 bg-card text-center text-ink-soft text-[14px] safe-bottom shrink-0">Esta conversa foi encerrada.</div>
      ) : (
        <div className="bg-card border-t border-surface-highest shrink-0 safe-bottom-tight">
          {replyTo && (
            <div className="flex items-center gap-2 px-3 pt-2">
              <div className="flex-1 min-w-0 rounded-xl bg-surface-low border-l-4 border-primary px-3 py-1.5">
                <div className="text-[12px] font-bold text-primary flex items-center gap-1"><CornerUpLeft className="w-3.5 h-3.5" />Respondendo a {authorOf(replyTo)}</div>
                <div className="text-[13px] text-ink-soft truncate">{snippet(replyTo)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} aria-label="Cancelar resposta" className="p-2 text-ink-soft"><X className="w-5 h-5" /></button>
            </div>
          )}
          <form onSubmit={send} className="relative p-2 flex items-end gap-2">
            {emoji && (
              <div className="absolute bottom-full left-2 mb-2 w-72 max-w-[calc(100vw-1rem)] bg-card rounded-2xl shadow-xl p-2 grid grid-cols-8 gap-1 z-30">
                {EMOJIS.map(e => <button type="button" key={e} onClick={() => setText(t => t + e)} className="text-[22px] rounded-lg hover:bg-surface-low aspect-square">{e}</button>)}
              </div>
            )}
            {media.recording ? media.recordingBar : (<>
              <button type="button" onClick={() => setEmoji(!emoji)} aria-label="Emojis" className={`p-2.5 rounded-full ${emoji ? 'bg-surface-mid text-primary' : 'text-ink-soft'}`}><Smile className="w-6 h-6" /></button>
              {media.attachButton}
              <textarea ref={inputRef} id="chat-input" rows={1} value={text} maxLength={2000} enterKeyHint="send"
                onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send() } }}
                placeholder="Mensagem…" className="flex-1 min-w-0 resize-none rounded-2xl bg-surface-low px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/30 max-h-32" />
              {text.trim()
                ? <button type="submit" aria-label="Enviar" onMouseDown={e => e.preventDefault()} className="w-11 h-11 rounded-full bg-secondary text-white flex items-center justify-center active:scale-90 transition"><Send className="w-5 h-5" /></button>
                : media.micButton}
            </>)}
            {media.fileInput}
            {error && <div className="absolute bottom-full right-2 mb-2 rounded-xl bg-secondary text-white text-[13px] px-3 py-2">{error}</div>}
          </form>
        </div>
      )}

      {/* Menu da conversa */}
      {menu && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setMenu(false)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-3 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setSdOpen(false)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h2 className="text-[20px] font-bold">Autodestruição</h2><button onClick={() => setSdOpen(false)} aria-label="Fechar"><X className="w-6 h-6" /></button></div>
            <p className="text-[13px] text-ink-soft mt-1">Vale para as próximas mensagens. O chat avisa a outra pessoa da mudança.</p>
            <div className="mt-3 space-y-2">{SELF_DESTRUCT.map(s => (
              <button key={String(s.secs)} onClick={() => setSD(s.secs)} className={`w-full flex justify-between items-center rounded-xl border p-3.5 font-semibold ${(conv.self_destruct_seconds || null) === s.secs ? 'border-violet bg-violet/10 text-violet' : 'border-ink-line/50'}`}>{s.label}{(conv.self_destruct_seconds || null) === s.secs && <Check className="w-5 h-5" />}</button>))}</div>
          </div>
        </div>
      )}
      {viewProfile && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setViewProfile(false)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-pop" onClick={e => e.stopPropagation()}>
            <ProfileDetails p={o} blurred={blurred} actions={<Button variant="soft" className="w-full" onClick={() => setViewProfile(false)}>Fechar</Button>} />
          </div>
        </div>
      )}
      <MessageMenu m={msgMenu} mine={msgMenu?.sender_id === profile.id} onClose={() => setMsgMenu(null)} onReply={onReply} onDelete={del} />
      {media.sheetEl}
      <ReportBlockSheet mode={sheet} person={o} conversationId={id} preset={preset} onClose={() => setSheet(null)} onBlocked={() => nav('/app/conversas')} />
    </div>
  )
}
