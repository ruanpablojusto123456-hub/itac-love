import { memo, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Ban, Check, CheckCheck, ChevronDown, Clock, CornerUpLeft, Timer, Trash2 } from 'lucide-react'
import { AudioMessage, ImageMessage } from './ChatMedia'
import { formatLeft } from '../lib/hooks'

// Resumo curto de uma mensagem (para a citação da resposta)
export function snippet(m) {
  if (!m) return 'Mensagem indisponível'
  if (m.deleted_for_all) return '🚫 Mensagem apagada'
  if (m.media_type === 'image') return m.view_once ? '📷 Foto de visualização única' : '📷 Foto'
  if (m.media_type === 'audio') return '🎤 Áudio'
  return m.body
}

// Contagem regressiva isolada: só ela re-renderiza a cada segundo (o resto do chat fica parado)
export function Countdown({ to, className = '' }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t) }, [])
  return <span className={className}>{formatLeft(new Date(to) - Date.now())}</span>
}

function Quote({ m, mine, author, onJump }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onJump?.() }}
      className={`block w-full text-left mb-1.5 rounded-lg px-2.5 py-1.5 border-l-4 ${mine ? 'bg-white/15 border-white/70' : 'bg-surface-low border-primary'}`}>
      <div className={`text-[12px] font-bold ${mine ? 'text-white' : 'text-primary'}`}>{author}</div>
      <div className={`text-[13px] line-clamp-2 ${mine ? 'text-white/85' : 'text-ink-soft'}`}>{snippet(m)}</div>
    </button>
  )
}

function MessageBubble({ m, mine, viewer, quoted, quotedAuthor, scam, blurred, highlight, onReply, onMenu, onJump, onReport }) {
  const [dx, setDx] = useState(0)
  const start = useRef(null)
  const longPress = useRef(null)
  const moved = useRef(false)
  const deleted = m.deleted_for_all

  // Arrastar para a direita = responder (como no WhatsApp). Segurar = menu.
  function onTouchStart(e) {
    const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; moved.current = false
    longPress.current = setTimeout(() => { if (!moved.current) { navigator.vibrate?.(15); onMenu(m) } }, 450)
  }
  function onTouchMove(e) {
    if (!start.current) return
    const t = e.touches[0]; const ddx = t.clientX - start.current.x; const ddy = t.clientY - start.current.y
    if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) { moved.current = true; clearTimeout(longPress.current) }
    if (Math.abs(ddy) > Math.abs(ddx)) return
    if (ddx > 0 && !deleted) setDx(Math.min(ddx, 90))
  }
  function onTouchEnd() {
    clearTimeout(longPress.current)
    if (dx > 60) { navigator.vibrate?.(10); onReply(m) }
    setDx(0); start.current = null
  }
  useEffect(() => () => clearTimeout(longPress.current), [])

  return (
    <div id={`msg-${m.id}`} className={`group relative flex flex-col ${mine ? 'items-end' : 'items-start'} transition-colors duration-700 rounded-xl ${highlight ? 'bg-primary/15' : ''}`}>
      {/* ícone de responder que aparece ao arrastar */}
      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card shadow flex items-center justify-center text-primary transition-opacity"
        style={{ opacity: dx / 60 }} aria-hidden><CornerUpLeft className="w-4 h-4" /></span>
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); onMenu(m) }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .2s ease' }}
        className={`relative max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words touch-pan-y
          ${deleted ? (mine ? 'bg-primary/60 text-white/85 italic' : 'bg-card text-ink-mute italic shadow-sm') : mine ? 'bg-primary text-white rounded-br-md' : 'bg-card text-ink rounded-bl-md shadow-sm'}
          ${m._pending ? 'opacity-70' : ''}`}>
        {/* botão de opções no computador (aparece ao passar o mouse) */}
        {!m._pending && <button type="button" onClick={() => onMenu(m)} aria-label="Opções da mensagem"
          className={`hidden md:flex absolute top-1 ${mine ? 'left-1 -translate-x-full -ml-1' : 'right-1 translate-x-full mr-[-4px]'} w-7 h-7 rounded-full bg-card shadow items-center justify-center text-ink-soft opacity-0 group-hover:opacity-100 transition`}><ChevronDown className="w-4 h-4" /></button>}

        {quoted !== undefined && !deleted && <Quote m={quoted} mine={mine} author={quotedAuthor} onJump={onJump} />}

        {deleted ? <span className="flex items-center gap-1.5"><Ban className="w-4 h-4" />{mine ? 'Você apagou esta mensagem' : 'Mensagem apagada'}</span>
          : m.media_type === 'image' ? <ImageMessage m={m} mine={mine} viewer={viewer} blurred={blurred} />
          : m.media_type === 'audio' ? <AudioMessage m={m} mine={mine} />
          : m.body}

        <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${mine ? 'text-white/75' : 'text-ink-mute'}`}>
          {m.expires_at && !deleted && <><Timer className="w-3 h-3" /><Countdown to={m.expires_at} /> ·</>}
          {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {mine && !deleted && (m._pending ? <Clock className="w-3.5 h-3.5" aria-label="Enviando" /> : m.read_at ? <CheckCheck className="w-3.5 h-3.5 text-mint" aria-label="Lida" /> : <Check className="w-3.5 h-3.5" aria-label="Enviada" />)}
        </span>
      </div>
      {scam && !deleted && (
        <div className="max-w-[80%] mt-1 rounded-xl bg-amber/15 border border-amber/40 px-3 py-2 text-[12px] text-amber-ink flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Cuidado: nunca envie dinheiro para quem você não conhece pessoalmente. <button onClick={onReport} className="font-bold underline">Denunciar</button></span>
        </div>
      )}
    </div>
  )
}

export default memo(MessageBubble)

// Menu da mensagem (segurar no celular / seta no computador)
export function MessageMenu({ m, mine, onClose, onReply, onDelete }) {
  if (!m) return null
  const canAll = mine && !m.deleted_for_all
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-3 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-2 text-[13px] text-ink-soft line-clamp-2">“{snippet(m)}”</div>
        {!m.deleted_for_all && <button onClick={() => { onReply(m); onClose() }} className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-surface-low text-left font-semibold"><CornerUpLeft className="w-5 h-5 text-primary" />Responder</button>}
        <button onClick={() => { onDelete(m, false); onClose() }} className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-surface-low text-left font-semibold"><Trash2 className="w-5 h-5 text-ink-soft" />Apagar para mim</button>
        {canAll && <button onClick={() => { onDelete(m, true); onClose() }} className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-surface-low text-left font-semibold text-secondary"><Trash2 className="w-5 h-5" />Apagar para todos</button>}
      </div>
    </div>
  )
}
