import { useEffect, useRef, useState } from 'react'
import { Camera, Eye, EyeOff, ImagePlus, Loader2, Mic, Pause, Play, Square, Trash2, X } from 'lucide-react'
import Watermark from '../components/Watermark'
import { api } from '../lib/api'
import { friendlyError } from '../lib/constants'
import { isNative } from '../lib/platform'
import { nativePick } from '../lib/pickImage'
import { blockCopy } from '../lib/protection'

function useMediaUrl(path) {
  const [url, setUrl] = useState(null)
  useEffect(() => { let on = true; if (path) api.mediaUrl(path).then(u => on && setUrl(u)); return () => { on = false } }, [path])
  return url
}

// Visualizador em tela cheia, com marca d'água e sem salvar/copiar
export function MediaViewer({ src, viewer, onClose, viewOnce }) {
  const [left, setLeft] = useState(viewOnce ? 10 : null)
  useEffect(() => {
    if (!viewOnce) return
    const t = setInterval(() => setLeft(s => { if (s <= 1) { clearInterval(t); onClose(); return 0 } return s - 1 }), 1000)
    return () => clearInterval(t)
  }, [viewOnce, onClose])
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col no-select" {...blockCopy}>
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-[14px] font-semibold flex items-center gap-2">{viewOnce ? <><Eye className="w-4 h-4" />Visualização única · fecha em {left}s</> : 'Foto'}</span>
        <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-full bg-white/10"><X className="w-6 h-6" /></button>
      </div>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {src ? <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain pointer-events-none" /> : <Loader2 className="w-8 h-8 text-white animate-spin" />}
        <Watermark name={viewer.name} id={viewer.id} light />
      </div>
    </div>
  )
}

export function ImageMessage({ m, mine, viewer, blurred }) {
  const url = useMediaUrl(m.view_once ? null : m.media_path)
  const [open, setOpen] = useState(null) // url aberta
  const [err, setErr] = useState('')
  async function openOnce() {
    setErr('')
    try { setOpen(await api.openViewOnce(m.id)) } catch (e) { setErr(friendlyError(e)) }
  }
  function close() { setOpen(null); if (m.view_once) api.finishViewOnce(m.id).catch(() => {}) }

  if (m.view_once) {
    const viewed = !!m.viewed_at
    return (
      <>
        <button disabled={mine || viewed} onClick={openOnce}
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${mine ? 'bg-white/15' : viewed ? 'bg-surface-mid text-ink-mute' : 'bg-violet/10 text-violet'}`}>
          {viewed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          {mine ? (viewed ? 'Foto de visualização única · aberta' : 'Foto de visualização única · enviada') : viewed ? 'Foto já vista' : 'Toque para ver a foto (1 vez)'}
        </button>
        {err && <p className="text-[12px] text-secondary mt-1">{err}</p>}
        {open && <MediaViewer src={open} viewer={viewer} viewOnce onClose={close} />}
      </>
    )
  }
  return (
    <>
      <button onClick={() => url && setOpen(url)} className="block relative rounded-xl overflow-hidden w-56 max-w-full aspect-[4/5] bg-surface-mid" aria-label="Abrir foto">
        {url ? <img src={url} alt="Foto enviada no chat" draggable={false} className={`w-full h-full object-cover ${blurred ? 'blur-xl' : ''}`} /> : <Loader2 className="w-6 h-6 m-auto animate-spin text-ink-mute" />}
        <Watermark name={viewer.name} id={viewer.id} />
      </button>
      {open && <MediaViewer src={open} viewer={viewer} onClose={() => setOpen(null)} />}
    </>
  )
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function AudioMessage({ m, mine }) {
  const url = useMediaUrl(m.media_path)
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const total = m.duration_sec || 0
  function toggle() { const a = ref.current; if (!a) return; if (a.paused) a.play(); else a.pause() }
  return (
    <div className="flex items-center gap-3 w-56 max-w-full">
      <button onClick={toggle} disabled={!url} aria-label={playing ? 'Pausar áudio' : 'Ouvir áudio'} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${mine ? 'bg-white/20 text-white' : 'bg-primary text-white'}`}>
        {!url ? <Loader2 className="w-5 h-5 animate-spin" /> : playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className={`h-1.5 rounded-full overflow-hidden ${mine ? 'bg-white/30' : 'bg-surface-highest'}`}><div className={`h-full ${mine ? 'bg-card' : 'bg-primary'}`} style={{ width: `${total ? Math.min(100, (pos / total) * 100) : 0}%` }} /></div>
        <div className={`text-[11px] mt-1 ${mine ? 'text-white/80' : 'text-ink-mute'}`}>🎤 {fmt(playing || pos ? pos : total)}</div>
      </div>
      {url && <audio ref={ref} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPos(0) }} onTimeUpdate={e => setPos(e.currentTarget.currentTime)} className="hidden" />}
    </div>
  )
}

// Botões de anexar foto e gravar áudio na barra do chat
export function useChatMedia(convId, setError) {
  const fileRef = useRef(null)
  const viewOnceRef = useRef(false)
  const [sheet, setSheet] = useState(false)
  const [sending, setSending] = useState(false)
  const [rec, setRec] = useState(null) // { seconds }
  const recorder = useRef(null)
  const chunks = useRef([])
  const startedAt = useRef(0)
  const timer = useRef(null)
  const cancelRef = useRef(false)

  async function sendImage(blob, viewOnce) {
    setSending(true)
    try { await api.sendMedia(convId, blob, { type: 'image', viewOnce }) } catch (e) { setError(friendlyError(e)) } finally { setSending(false) }
  }
  async function pick(viewOnce) {
    setSheet(false)
    if (isNative()) { try { await sendImage(await nativePick({ source: 'prompt' }), viewOnce) } catch { /* cancelado */ } return }
    viewOnceRef.current = viewOnce; fileRef.current?.click()
  }
  const fileInput = <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendImage(f, viewOnceRef.current) }} />

  async function startRec() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setError('Seu aparelho não permite gravar áudio aqui.')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported?.(t)) || ''
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      chunks.current = []; cancelRef.current = false
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); clearInterval(timer.current)
        const secs = Math.round((Date.now() - startedAt.current) / 1000)
        setRec(null)
        if (cancelRef.current || secs < 1) return
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
        setSending(true)
        try { await api.sendMedia(convId, blob, { type: 'audio', duration: Math.min(secs, 180) }) } catch (e) { setError(friendlyError(e)) } finally { setSending(false) }
      }
      recorder.current = r; startedAt.current = Date.now(); r.start()
      setRec({ seconds: 0 })
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - startedAt.current) / 1000)
        setRec({ seconds: s }); if (s >= 120) recorder.current?.stop()
      }, 500)
    } catch { setError('Permita o uso do microfone para gravar áudio.') }
  }
  const stopRec = () => recorder.current?.state === 'recording' && recorder.current.stop()
  const cancelRec = () => { cancelRef.current = true; stopRec() }

  const attachButton = (
    <button type="button" onClick={() => setSheet(true)} disabled={sending} aria-label="Enviar foto" className="p-2.5 rounded-full text-ink-soft disabled:opacity-40">
      {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
    </button>
  )
  const micButton = <button type="button" onClick={startRec} disabled={sending} aria-label="Gravar áudio" className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40"><Mic className="w-5 h-5" /></button>
  const recordingBar = rec && (
    <div className="flex-1 flex items-center gap-3 rounded-2xl bg-secondary-fixed/50 px-4 py-2.5">
      <span className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
      <span className="font-semibold tabular-nums">{fmt(rec.seconds)}</span>
      <span className="text-[13px] text-ink-soft flex-1">Gravando… (máx. 2 min)</span>
      <button type="button" onClick={cancelRec} aria-label="Descartar áudio" className="p-1.5 text-secondary"><Trash2 className="w-5 h-5" /></button>
      <button type="button" onClick={stopRec} aria-label="Parar e enviar" className="w-9 h-9 rounded-full bg-secondary text-white flex items-center justify-center"><Square className="w-4 h-4 fill-white" /></button>
    </div>
  )
  const sheetEl = sheet && (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setSheet(false)}>
      <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-3 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
        <button onClick={() => pick(false)} className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-surface-low text-left"><Camera className="w-5 h-5 text-primary" /><span><b className="block">Enviar foto</b><span className="text-[13px] text-ink-soft">Fica na conversa</span></span></button>
        <button onClick={() => pick(true)} className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-surface-low text-left"><Eye className="w-5 h-5 text-violet" /><span><b className="block">Foto de visualização única</b><span className="text-[13px] text-ink-soft">A pessoa vê uma vez, por 10 segundos, e ela some</span></span></button>
      </div>
    </div>
  )
  return { fileInput, attachButton, micButton, recordingBar, sheetEl, recording: !!rec }
}
