import { useEffect, useRef, useState } from 'react'
import { Camera as CamIcon, RefreshCw, X } from 'lucide-react'

// Webcam/câmera do navegador com guia de enquadramento.
// guide: 'face' (foto de perfil) | 'selfie-doc' (rosto + documento ao lado)
export default function CameraModal({ open, guide = 'face', onClose, onCapture }) {
  const video = useRef(null)
  const stream = useRef(null)
  const [error, setError] = useState('')
  const [facing, setFacing] = useState('user')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    ;(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        if (cancelled) return s.getTracks().forEach(t => t.stop())
        stream.current = s
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}) }
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere a câmera nas configurações do navegador ou envie um arquivo.' : 'Não encontramos uma câmera disponível. Use a opção de enviar arquivo.')
      }
    })()
    return () => { cancelled = true; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null }
  }, [open, facing])

  function capture() {
    const v = video.current; if (!v?.videoWidth) return
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    const g = c.getContext('2d')
    if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1) } // desfaz o espelhamento da prévia
    g.drawImage(v, 0, 0)
    c.toBlob(b => { if (b) { onCapture(b); onClose() } }, 'image/jpeg', 0.9)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col pt-safe">
      <div className="flex items-center justify-between p-4 text-white">
        <button onClick={onClose} aria-label="Fechar câmera" className="p-2 rounded-full bg-white/10"><X className="w-6 h-6" /></button>
        <span className="font-display font-semibold">{guide === 'selfie-doc' ? 'Selfie com documento' : 'Foto de perfil'}</span>
        <button onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')} aria-label="Trocar câmera" className="p-2 rounded-full bg-white/10"><RefreshCw className="w-6 h-6" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden flex items-center justify-center">
        {error ? <p className="text-white text-center px-8">{error}</p> : (
          <>
            <video ref={video} playsInline muted className={`max-h-full max-w-full ${facing === 'user' ? '-scale-x-100' : ''}`} />
            {/* Guia de enquadramento */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {guide === 'selfie-doc' ? (
                <div className="relative w-[86%] max-w-lg aspect-[4/3]">
                  <div className="absolute left-[6%] top-[8%] w-[46%] h-[78%] rounded-[50%] border-4 border-dashed border-white/80" />
                  <div className="absolute right-[4%] top-[34%] w-[40%] h-[34%] rounded-xl border-4 border-dashed border-mint" />
                  <span className="absolute left-[12%] bottom-0 text-white text-[13px] font-semibold bg-black/50 rounded px-2">Seu rosto</span>
                  <span className="absolute right-[6%] top-[70%] text-mint text-[13px] font-semibold bg-black/50 rounded px-2">RG ou CNH aqui</span>
                </div>
              ) : <div className="w-[60%] max-w-xs aspect-[3/4] rounded-[50%] border-4 border-dashed border-white/80" />}
            </div>
          </>
        )}
      </div>
      <div className="p-6 flex flex-col items-center gap-3 safe-bottom">
        {guide === 'selfie-doc' && !error && <p className="text-white/80 text-[13px] text-center">Segure o documento ao lado do queixo, sem cobrir o rosto, com boa luz.</p>}
        <button onClick={capture} disabled={!!error} aria-label="Tirar foto" className="w-20 h-20 rounded-full bg-card border-[6px] border-white/40 flex items-center justify-center disabled:opacity-40 active:scale-95"><CamIcon className="w-8 h-8 text-ink" /></button>
      </div>
    </div>
  )
}
