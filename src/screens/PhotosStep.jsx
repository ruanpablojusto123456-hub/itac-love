import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, Check, ImagePlus, Loader2, Star, Trash2, Upload, X, Sun, UserRound, Ban } from 'lucide-react'
import { BottomBar, Button, ErrorBox, StepHeader } from '../components/ui'
import CameraModal from '../components/CameraModal'
import PhotoImg from '../components/PhotoImg'
import { api } from '../lib/api'
import { isNative } from '../lib/platform'
import { nativePick } from '../lib/pickImage'
import { friendlyError } from '../lib/constants'

export default function PhotosStep() {
  const nav = useNavigate()
  const [photos, setPhotos] = useState(null)
  const [busy, setBusy] = useState(0)
  const [sheet, setSheet] = useState(0)     // posição aguardando escolha (web)
  const [cam, setCam] = useState(0)         // posição com webcam aberta
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const target = useRef(0)

  const load = () => api.getMyPhotos().then(setPhotos)
  useEffect(() => { load() }, [])

  async function upload(position, blob) {
    setError(''); setBusy(position)
    try {
      if (!blob.type.startsWith('image/')) throw new Error('Envie um arquivo de imagem (JPG ou PNG).')
      await api.uploadPhoto(position, blob); await load()
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(0) }
  }
  async function choose(position) {
    if (isNative()) {
      try { const b = await nativePick({ source: 'prompt' }); await upload(position, b) } catch { /* cancelado */ }
    } else setSheet(position)
  }
  async function remove(position) { setBusy(position); try { await api.removePhoto(position); await load() } finally { setBusy(0) } }

  const count = photos?.length || 0
  const byPos = (p) => photos?.find(x => x.position === p)

  return (
    <div className="pb-32">
      <StepHeader step={2} title="Suas fotos" subtitle="Fotos · 50%" back="/cadastro/perfil" />
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-6">
        <div>
          <h1 className="text-[26px] font-bold leading-tight">Mostre quem você é</h1>
          <p className="text-ink-soft mt-1">Envie <b>exatamente 3 fotos</b> suas. Elas serão comparadas com a selfie da verificação.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(pos => {
            const ph = byPos(pos)
            return (
              <div key={pos} className="relative aspect-[3/4]">
                {ph ? (
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-md relative group">
                    <PhotoImg path={ph.path} className="w-full h-full object-cover" alt={`Foto ${pos}`} />
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-tertiary text-white flex items-center justify-center"><Check className="w-4 h-4" /></div>
                    <div className="absolute bottom-0 inset-x-0 flex justify-center gap-2 p-2 bg-gradient-to-t from-black/60">
                      <button onClick={() => choose(pos)} aria-label="Trocar foto" className="p-2 rounded-full bg-card/90 text-ink"><Camera className="w-4 h-4" /></button>
                      <button onClick={() => remove(pos)} aria-label="Remover foto" className="p-2 rounded-full bg-card/90 text-secondary"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => choose(pos)} className="w-full h-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary-fixed/20 hover:bg-primary-fixed/40 flex flex-col items-center justify-center gap-2 text-primary transition">
                    <ImagePlus className="w-8 h-8" /><span className="text-[13px] font-semibold">Foto {pos}</span>
                  </button>
                )}
                {pos === 1 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-secondary text-white text-[11px] font-bold px-2 py-0.5 shadow"><Star className="w-3 h-3" />Principal</span>}
                {busy === pos && <div className="absolute inset-0 rounded-2xl bg-card/70 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>}
              </div>)
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-surface-highest overflow-hidden"><div className="h-full bg-tertiary transition-all" style={{ width: `${(count / 3) * 100}%` }} /></div>
          <span className={`font-bold text-[14px] ${count === 3 ? 'text-tertiary' : 'text-ink-soft'}`}>{count}/3 fotos</span>
        </div>

        <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
          <div className="font-display font-semibold text-[17px]">Dicas para fotos que dão match</div>
          {[[UserRound, 'Rosto visível e sozinho(a) em pelo menos uma foto', 'text-tertiary'], [Sun, 'Boa iluminação, de preferência luz natural', 'text-tertiary'], [Ban, 'Nada de fotos de outras pessoas, celebridades ou da internet', 'text-secondary']].map(([I, t, c]) => (
            <div key={t} className="flex gap-3 text-[14px]"><I className={`w-5 h-5 shrink-0 ${c}`} />{t}</div>))}
        </div>
        <ErrorBox>{error}</ErrorBox>
      </main>

      <BottomBar>
        <Button onClick={() => nav('/cadastro/interesses')} disabled={count !== 3} className="w-full">
          {count === 3 ? <>Continuar para Interesses<ArrowRight className="w-5 h-5" /></> : `Faltam ${3 - count} foto${3 - count > 1 ? 's' : ''}`}
        </Button>
      </BottomBar>

      {/* Escolha de origem na web */}
      {sheet > 0 && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setSheet(0)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-3 animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><span className="font-display font-semibold text-[18px]">Foto {sheet}</span><button onClick={() => setSheet(0)} aria-label="Fechar"><X className="w-6 h-6" /></button></div>
            <Button variant="ocean" className="w-full" onClick={() => { target.current = sheet; setSheet(0); fileRef.current.click() }}><Upload className="w-5 h-5" />Enviar arquivo</Button>
            <Button variant="outline" className="w-full" onClick={() => { setCam(sheet); setSheet(0) }}><Camera className="w-5 h-5" />Usar a câmera / webcam</Button>
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(target.current, f) }} />
      <CameraModal open={cam > 0} guide="face" onClose={() => setCam(0)} onCapture={b => upload(cam, b)} />
    </div>
  )
}
