import { useCallback, useEffect, useState } from 'react'
import { Camera, CheckCircle2, Clock, Inbox, XCircle, ShieldAlert } from 'lucide-react'
import { Button, Card, ErrorBox, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { api } from '../lib/api'
import { LOOKING_FOR, REJECT_PRESETS, ageFrom, friendlyError, genderLabel } from '../lib/constants'

const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d` }

// Marca d'água sobre a imagem do documento (uso exclusivo da moderação)
function Watermark() {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25 text-white text-[11px] font-bold leading-[3.2] rotate-[-18deg] scale-150 whitespace-pre select-none" aria-hidden>
    {Array.from({ length: 14 }, () => 'USO EXCLUSIVO DA MODERAÇÃO · ITAC LOVE    ').join('\n')}
  </div>
}

function Detail({ v, onDone }) {
  const [mode, setMode] = useState(null) // 'reject' | 'resubmit'
  const [reason, setReason] = useState('')
  const [doc, setDoc] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const p = v.profile
  const age = ageFrom(p.birth_date)

  async function act(decision) {
    setError('')
    if (decision === 'reject' && !reason.trim()) return setError('Informe o motivo da reprovação.')
    setBusy(decision)
    try {
      const final = await api.adminReview(v.id, decision, reason.trim() || null, doc.trim() || null)
      onDone(final !== decision ? `Atenção: a decisão virou "${final === 'reject' ? 'reprovado' : final}" — documento já usado ou banido.` : null)
    } catch (e) { setError(friendlyError(e)) } finally { setBusy('') }
  }

  return (
    <Card className="p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-bold">{p.name}, {age}</h2>
          <p className="text-ink-soft text-[14px]">{p.email} · {p.city}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber/20 text-amber-ink px-3 py-1 text-[12px] font-bold"><Clock className="w-4 h-4" />Aguardando há {ago(v.created_at)}</span>
          {v.previous > 0 && <span className="rounded-full bg-violet/15 text-violet px-3 py-1 text-[12px] font-bold">{v.previous} envio(s) anterior(es)</span>}
          {age < 18 && <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-white px-3 py-1 text-[12px] font-bold"><ShieldAlert className="w-4 h-4" />MENOR DE IDADE</span>}
        </div>
      </div>

      {/* Selfie + documento lado a lado com as 3 fotos */}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 mt-5">
        <div>
          <div className="text-[12px] font-bold uppercase text-ink-soft mb-1.5">Selfie com documento</div>
          <div className="relative rounded-2xl overflow-hidden bg-night no-select" onContextMenu={e => e.preventDefault()}>
            {v.selfie_path ? <PhotoImg selfie path={v.selfie_path} className="w-full max-h-[420px] object-contain" alt="Selfie com documento" /> : <div className="p-10 text-white/70 text-center">Imagem já excluída</div>}
            <Watermark />
          </div>
        </div>
        <div>
          <div className="text-[12px] font-bold uppercase text-ink-soft mb-1.5">Fotos do perfil</div>
          <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
            {v.photos.map((ph, i) => <PhotoImg key={ph} path={ph} className={`w-full aspect-[3/4] object-cover rounded-xl ${i === 0 ? 'lg:col-span-2 lg:aspect-[4/3]' : ''}`} alt={`Foto ${i + 1}`} />)}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-5 text-[14px]">
        <div><b>Nascimento:</b> {p.birth_date ? new Date(p.birth_date + 'T12:00').toLocaleDateString('pt-BR') : '—'} ({age} anos)</div>
        <div><b>Gênero:</b> {genderLabel(p.gender_identity, p.gender_other)} · {p.orientation}</div>
        <div><b>Buscando:</b> {LOOKING_FOR.find(l => l.id === p.looking_for)?.label}</div>
        <div><b>Interesses:</b> {v.interests.join(', ')}</div>
        <div className="sm:col-span-2"><b>Bio:</b> <span className="text-ink-soft">{p.bio}</span></div>
      </div>

      <div className="mt-5 rounded-2xl bg-surface-low p-4">
        <label className="label" htmlFor="doc">Número do RG/CNH visto na foto <span className="font-normal text-ink-soft text-[13px]">(opcional — guardamos só um código irreversível para bloquear contas duplicadas e banidas)</span></label>
        <input id="doc" className="field bg-card" value={doc} onChange={e => setDoc(e.target.value)} placeholder="Ex.: MG-12.345.678" />
      </div>

      {mode && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-ink-line p-4">
          <div className="font-semibold mb-2">{mode === 'reject' ? 'Motivo da reprovação (obrigatório)' : 'O que precisa melhorar na nova foto?'}</div>
          <div className="flex flex-wrap gap-2 mb-3">{REJECT_PRESETS.map(r => <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-3 py-1 text-[13px] ${reason === r ? 'bg-night text-white border-ink' : 'bg-card border-ink-line'}`}>{r}</button>)}</div>
          <textarea className="field bg-card" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Escreva o motivo que o usuário vai ver" />
        </div>
      )}
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!mode && <>
          <Button variant="green" onClick={() => act('approve')} loading={busy === 'approve'} disabled={age < 18}><CheckCircle2 className="w-5 h-5" />Aprovar</Button>
          <Button variant="outline" onClick={() => setMode('resubmit')}><Camera className="w-5 h-5" />Pedir nova foto</Button>
          <Button variant="danger" onClick={() => setMode('reject')}><XCircle className="w-5 h-5" />Reprovar</Button>
        </>}
        {mode && <>
          <Button variant={mode === 'reject' ? 'love' : 'ocean'} onClick={() => act(mode)} loading={!!busy}>{mode === 'reject' ? 'Confirmar reprovação' : 'Enviar pedido de nova foto'}</Button>
          <Button variant="soft" onClick={() => { setMode(null); setReason('') }}>Cancelar</Button>
        </>}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">Após a decisão, a imagem do documento é excluída definitivamente do servidor e o usuário é notificado.</p>
    </Card>
  )
}

export default function VerificationQueue() {
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)
  const [flash, setFlash] = useState('')
  const load = useCallback(() => api.adminListPending().then(l => { setList(l); setSel(s => l.find(x => x.id === s?.id) ? s : l[0] || null) }), [])
  useEffect(() => { load(); const off = api.onChange(load); return off }, [load])

  if (!list) return <Spinner />
  return (
    <div className="max-w-6xl">
      <h1 className="text-[28px] font-bold">Verificações pendentes <span className="text-ink-soft font-normal text-[20px]">({list.length})</span></h1>
      {flash && <div className="mt-3 rounded-xl bg-amber/20 text-amber-ink font-semibold px-4 py-3 text-[14px]">{flash}</div>}
      {!list.length ? (
        <Card className="mt-6 p-10 text-center text-ink-soft"><Inbox className="w-10 h-10 mx-auto mb-2 text-tertiary" />Nenhuma verificação pendente. Tudo em dia!</Card>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4 mt-5">
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1">
            {list.map(v => (
              <button key={v.id} onClick={() => { setSel(v); setFlash('') }} className={`flex items-center gap-3 rounded-2xl p-2.5 text-left min-w-[220px] transition ${sel?.id === v.id ? 'bg-card shadow-md ring-2 ring-primary' : 'bg-card/60 hover:bg-card'}`}>
                <PhotoImg path={v.photos[0]} className="w-12 h-12 rounded-xl object-cover" alt="" />
                <div className="min-w-0"><div className="font-semibold truncate">{v.profile.name}, {ageFrom(v.profile.birth_date)}</div><div className="text-[12px] text-ink-soft">há {ago(v.created_at)}{v.previous ? ' · reenvio' : ''}</div></div>
              </button>))}
          </div>
          {sel && <Detail key={sel.id} v={sel} onDone={(msg) => { setFlash(msg || ''); load() }} />}
        </div>
      )}
    </div>
  )
}
