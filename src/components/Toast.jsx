import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, X } from 'lucide-react'
import { askNotify, notifPermission } from '../lib/notify'

// Aviso no topo (como o WhatsApp) quando chega mensagem/match/convite com o app aberto
export function InAppToast() {
  const nav = useNavigate()
  const [t, setT] = useState(null)
  useEffect(() => {
    let timer
    const on = (e) => { setT(e.detail); clearTimeout(timer); timer = setTimeout(() => setT(null), 4500); navigator.vibrate?.(30) }
    window.addEventListener('itac-toast', on)
    return () => { window.removeEventListener('itac-toast', on); clearTimeout(timer) }
  }, [])
  if (!t) return null
  return (
    <div className="fixed inset-x-0 top-safe z-[65] p-3 pointer-events-none">
      <button onClick={() => { setT(null); if (t.route) nav(t.route) }}
        className="pointer-events-auto w-full max-w-md mx-auto flex items-center gap-3 rounded-2xl bg-card shadow-2xl border border-surface-highest p-3 text-left animate-pop">
        <span className="w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center shrink-0"><MessageCircle className="w-5 h-5" /></span>
        <span className="flex-1 min-w-0"><b className="block truncate">{t.title}</b><span className="block text-[14px] text-ink-soft truncate">{t.body}</span></span>
        <span onClick={(e) => { e.stopPropagation(); setT(null) }} className="p-1 text-ink-mute" aria-label="Fechar"><X className="w-4 h-4" /></span>
      </button>
    </div>
  )
}

// Pede permissão de notificação uma vez (pode dispensar)
export function NotifyPrompt() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try { dismissed = !!localStorage.getItem('itac_notif_prompt') } catch { /* sem storage */ }
    if (!dismissed) notifPermission().then(p => setShow(p === 'default' || p === 'prompt' || p === 'prompt-with-rationale'))
  }, [])
  const close = () => { setShow(false); try { localStorage.setItem('itac_notif_prompt', '1') } catch { /* sem storage */ } }
  if (!show) return null
  return (
    <div className="mx-4 mt-3 max-w-xl lg:mx-auto rounded-2xl bg-primary text-white p-4 flex items-center gap-3 shadow-lg">
      <Bell className="w-6 h-6 shrink-0" />
      <div className="flex-1 text-[14px]"><b className="block">Ative as notificações</b>Saiba na hora quando chegar mensagem, match ou convite.</div>
      <button onClick={async () => { await askNotify(); close() }} className="bg-white text-primary font-bold rounded-full px-4 py-2 text-[14px] shrink-0">Ativar</button>
      <button onClick={close} aria-label="Agora não" className="p-1"><X className="w-5 h-5" /></button>
    </div>
  )
}
