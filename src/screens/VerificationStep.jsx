import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, Check, Lock, RotateCcw, ShieldCheck, Upload, X, AlertTriangle } from 'lucide-react'
import { BottomBar, Button, ErrorBox, StepHeader } from '../components/ui'
import CameraModal from '../components/CameraModal'
import { api } from '../lib/api'
import { useSession } from '../lib/session'
import { isNative } from '../lib/platform'
import { nativePick } from '../lib/pickImage'
import { friendlyError } from '../lib/constants'

// Ilustração própria: pessoa segurando o documento ao lado do queixo
function ExampleIllustration() {
  return (
    <svg viewBox="0 0 360 230" className="w-full h-auto rounded-xl" role="img" aria-label="Exemplo: pessoa segurando o documento ao lado do rosto">
      <defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#cce5ff" /><stop offset="1" stopColor="#eaedff" /></linearGradient></defs>
      <rect width="360" height="230" fill="url(#bg)" />
      <ellipse cx="150" cy="250" rx="95" ry="80" fill="#006194" />
      <rect x="133" y="140" width="34" height="30" fill="#e8b48f" />
      <ellipse cx="150" cy="100" rx="44" ry="52" fill="#f0c29f" />
      <path d="M104 92c0-38 22-56 46-56s48 16 48 56c-8-18-24-28-48-28s-38 10-46 28z" fill="#3b2a20" />
      <circle cx="134" cy="100" r="4.5" fill="#131b2e" /><circle cx="166" cy="100" r="4.5" fill="#131b2e" />
      <path d="M136 124q14 12 28 0" stroke="#b60e3d" strokeWidth="4" fill="none" strokeLinecap="round" />
      <g transform="rotate(-6 250 125)">
        <rect x="200" y="95" width="104" height="66" rx="8" fill="#fff" stroke="#00855b" strokeWidth="3" />
        <rect x="210" y="106" width="26" height="34" rx="3" fill="#f0c29f" />
        <rect x="244" y="108" width="50" height="6" rx="3" fill="#006194" /><rect x="244" y="120" width="42" height="5" rx="2.5" fill="#bfc7d2" />
        <rect x="244" y="130" width="46" height="5" rx="2.5" fill="#bfc7d2" /><rect x="210" y="146" width="84" height="5" rx="2.5" fill="#bfc7d2" />
      </g>
      <ellipse cx="205" cy="160" rx="16" ry="12" fill="#f0c29f" />
      <g fontFamily="Plus Jakarta Sans, sans-serif" fontSize="12" fontWeight="700">
        <rect x="12" y="12" width="128" height="24" rx="12" fill="#fff" opacity=".92" /><text x="24" y="28" fill="#006947">✓ Rosto descoberto</text>
        <rect x="222" y="12" width="126" height="24" rx="12" fill="#fff" opacity=".92" /><text x="234" y="28" fill="#006947">✓ RG/CNH nítido</text>
        <rect x="12" y="194" width="118" height="24" rx="12" fill="#fff" opacity=".92" /><text x="24" y="210" fill="#006194">☀ Boa iluminação</text>
        <rect x="206" y="194" width="142" height="24" rx="12" fill="#fff" opacity=".92" /><text x="218" y="210" fill="#006194">Ao lado do queixo</text>
      </g>
    </svg>
  )
}

export default function VerificationStep() {
  const { profile, refresh } = useSession()
  const nav = useNavigate()
  const [blob, setBlob] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cam, setCam] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { if (!blob) return setPreview(null); const u = URL.createObjectURL(blob); setPreview(u); return () => URL.revokeObjectURL(u) }, [blob])

  async function openCamera() {
    setError('')
    if (isNative()) { try { setBlob(await nativePick({ source: 'camera', front: true })) } catch { /* cancelado */ } }
    else setCam(true)
  }
  async function send() {
    setSending(true); setError('')
    try { await api.submitVerification(blob); await refresh(); nav('/aguardando', { replace: true }) }
    catch (e) {
      const m = friendlyError(e); setError(m)
      if (/3 fotos/.test(m)) setTimeout(() => nav('/cadastro/fotos'), 1500)
      if (/interesses/.test(m)) setTimeout(() => nav('/cadastro/interesses'), 1500)
      if (/campos|Termos/.test(m)) setTimeout(() => nav('/cadastro/perfil'), 1500)
    } finally { setSending(false) }
  }

  return (
    <div className="pb-36">
      <StepHeader step={4} title="Verificação" subtitle="Verificação final · 100%" back={profile.status === 'onboarding' ? '/cadastro/interesses' : '/aguardando'} />
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-6">
        {profile.status === 'needs_new_photo' && (
          <div className="rounded-2xl bg-amber/15 border border-amber/40 p-4 flex gap-3 text-[14px]"><AlertTriangle className="w-5 h-5 text-amber shrink-0" /><div><b>A moderação pediu uma nova foto:</b> {profile.rejection_reason}</div></div>
        )}
        <span className="inline-flex items-center gap-2 rounded-full bg-tertiary-fixed/50 text-tertiary px-3 py-1.5 text-[13px] font-bold"><ShieldCheck className="w-4 h-4" />Comunidade segura e autêntica</span>
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Selfie com seu documento</h1>
          <p className="text-ink-soft mt-2">Para manter o <b>ITAC LOVE</b> livre de perfis falsos e golpes, tire uma selfie segurando seu <b>RG ou CNH</b> ao lado do rosto. Uma pessoa da moderação confere e libera seu acesso.</p>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3"><span className="font-semibold">Como posicionar sua foto</span><span className="rounded-full bg-primary-fixed text-primary text-[12px] font-bold px-2.5 py-1">Exemplo correto</span></div>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Sua selfie com documento" className="w-full rounded-xl object-contain max-h-80 bg-surface-low" />
              <button onClick={() => setBlob(null)} className="absolute top-2 right-2 bg-card/90 rounded-full p-2 shadow" aria-label="Descartar foto"><X className="w-5 h-5" /></button>
            </div>
          ) : <ExampleIllustration />}
          <ul className="mt-4 space-y-3 text-[14px]">
            {['Rosto e documento bem iluminados', 'Dados do documento (nome e foto) nítidos e legíveis', 'Documento ao lado do queixo, sem cobrir a boca'].map(t => (
              <li key={t} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-tertiary-fixed/60 text-tertiary flex items-center justify-center shrink-0"><Check className="w-4 h-4" /></span>{t}</li>))}
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-secondary-fixed/70 text-secondary flex items-center justify-center shrink-0"><X className="w-4 h-4" /></span>Evite óculos escuros, boné, chapéu ou máscara</li>
          </ul>
        </div>

        {!preview && (
          <div className="rounded-2xl bg-surface-mid p-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary-fixed flex items-center justify-center"><Camera className="w-8 h-8 text-primary" /></div>
            <div className="font-display font-semibold text-[20px] mt-3">Preparado(a)?</div>
            <p className="text-[14px] text-ink-soft mt-1">Use a câmera frontal e garanta que o ambiente esteja claro.</p>
            <div className="mt-4 flex flex-col gap-2.5">
              <Button variant="ocean" onClick={openCamera}><Camera className="w-5 h-5" />{isNative() ? 'Abrir Câmera do Celular' : 'Abrir Câmera / Webcam'}</Button>
              {!isNative() && <Button variant="outline" onClick={() => fileRef.current.click()}><Upload className="w-5 h-5" />Enviar foto do computador</Button>}
            </div>
          </div>
        )}
        {preview && <Button variant="outline" className="w-full" onClick={openCamera}><RotateCcw className="w-5 h-5" />Tirar outra foto</Button>}

        <div className="rounded-2xl bg-surface-low p-4 flex gap-3">
          <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-soft"><b className="text-ink text-[14px] block">Privacidade e proteção (LGPD)</b>Sua selfie com documento é guardada criptografada, vista <b>apenas pela moderação</b> e <b>excluída definitivamente</b> logo após a análise. Fica registrado só o resultado da verificação.</div>
        </div>
        <ErrorBox>{error}</ErrorBox>
      </main>
      <BottomBar>
        <Button onClick={send} loading={sending} disabled={!blob} className="w-full">Enviar para Análise<ArrowRight className="w-5 h-5" /></Button>
        <p className="text-center text-[12px] text-ink-soft mt-2">Tempo médio de análise: <b>até 24 horas</b></p>
      </BottomBar>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setBlob(f) }} />
      <CameraModal open={cam} guide="selfie-doc" onClose={() => setCam(false)} onCapture={setBlob} />
    </div>
  )
}
