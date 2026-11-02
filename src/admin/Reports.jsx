import { useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, Clock, PauseCircle, ShieldAlert, XCircle, Inbox } from 'lucide-react'
import { Button, Card, ErrorBox, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { api } from '../lib/api'
import { useLive } from '../lib/hooks'
import { friendlyError, reportLabel } from '../lib/constants'

export function TrustBar({ v }) {
  const c = v >= 60 ? 'bg-tertiary' : v >= 30 ? 'bg-amber' : 'bg-secondary'
  return <div className="flex items-center gap-2"><div className="w-24 h-2 rounded-full bg-surface-highest overflow-hidden"><div className={`h-full ${c}`} style={{ width: `${v}%` }} /></div><b className="tabular-nums text-[13px]">{v}</b></div>
}

function ReportCard({ r }) {
  const [note, setNote] = useState('')
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function act(confirm, action) {
    setBusy(action || String(confirm)); setError('')
    try { await api.adminResolveReport(r.id, confirm, note, action, days) } catch (e) { setError(friendlyError(e)) } finally { setBusy('') }
  }
  const u = r.reported
  return (
    <Card className="p-5">
      <div className="flex flex-wrap gap-4">
        <PhotoImg path={u.photo} className="w-20 h-24 rounded-xl object-cover" alt="" />
        <div className="flex-1 min-w-[200px]">
          <div className="flex flex-wrap items-center gap-2"><b className="text-[18px]">{u.name}</b><span className="text-[13px] text-ink-soft">{u.email}</span>
            <span className="rounded-full bg-surface-mid px-2 py-0.5 text-[12px] font-bold">{{ approved: 'Aprovado', under_review: 'Em revisão', suspended: 'Suspenso', banned: 'Banido' }[u.status] || u.status}</span></div>
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]"><span className="flex items-center gap-2">Nota de confiança <TrustBar v={u.trust_score} /></span><span>Advertências: <b>{u.warnings}</b></span></div>
          <div className="mt-3 rounded-xl bg-secondary-fixed/40 p-3">
            <div className="flex items-center gap-2 font-bold text-secondary"><AlertTriangle className="w-4 h-4" />{reportLabel(r.reason)}</div>
            {r.details && <p className="text-[14px] mt-1">{r.details}</p>}
            <p className="text-[12px] text-ink-soft mt-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Por {r.reporter_name} em {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
          </div>
          {r.history.length > 0 && <div className="mt-2 text-[13px]"><b>Histórico:</b> {r.history.map((h, i) => <span key={i} className="inline-block mr-2 rounded-full bg-surface-mid px-2 py-0.5 text-[12px]">{reportLabel(h.reason)} · {h.status === 'confirmed' ? 'confirmada' : h.status === 'dismissed' ? 'descartada' : 'aberta'}</span>)}</div>}
        </div>
      </div>
      {r.status === 'open' ? (<>
        <textarea className="field mt-4" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Observação da moderação (opcional; vai na advertência)" />
        <p className="text-[12px] text-ink-soft mt-2">Só denúncias <b>confirmadas</b> reduzem a nota de confiança. Descartar não afeta o usuário.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="soft" className="!py-2.5" loading={busy === 'false'} onClick={() => act(false)}><XCircle className="w-4 h-4" />Descartar</Button>
          <Button variant="ocean" className="!py-2.5" loading={busy === 'true'} onClick={() => act(true)}><CheckCircle2 className="w-4 h-4" />Confirmar</Button>
          <Button variant="outline" className="!py-2.5" loading={busy === 'warn'} onClick={() => act(true, 'warn')}><ShieldAlert className="w-4 h-4" />Confirmar + advertir</Button>
          <span className="inline-flex items-center gap-1">
            <Button variant="outline" className="!py-2.5" loading={busy === 'suspend'} onClick={() => act(true, 'suspend')}><PauseCircle className="w-4 h-4" />Suspender</Button>
            <select value={days} onChange={e => setDays(+e.target.value)} className="rounded-full border border-ink-line px-2 py-2 text-[13px]" aria-label="Dias de suspensão">{[1, 3, 7, 15, 30].map(d => <option key={d} value={d}>{d} dia(s)</option>)}</select>
          </span>
          <Button variant="love" className="!py-2.5" loading={busy === 'ban'} onClick={() => act(true, 'ban')}><Ban className="w-4 h-4" />Banir permanentemente</Button>
        </div>
        <div className="mt-2"><ErrorBox>{error}</ErrorBox></div>
      </>) : <p className="mt-3 text-[13px] font-semibold">{r.status === 'confirmed' ? '✓ Confirmada' : 'Descartada'}{r.admin_note ? ` — ${r.admin_note}` : ''}</p>}
    </Card>
  )
}

export default function Reports() {
  const [status, setStatus] = useState('open')
  const { data } = useLive(() => api.adminListReports(status), [status])
  return (
    <div className="max-w-4xl">
      <h1 className="text-[28px] font-bold">Denúncias</h1>
      <div className="flex gap-2 mt-3">{[['open', 'Abertas'], ['confirmed', 'Confirmadas'], ['dismissed', 'Descartadas'], ['all', 'Todas']].map(([id, l]) => <button key={id} onClick={() => setStatus(id)} className={`rounded-full px-4 py-2 text-[14px] font-semibold ${status === id ? 'bg-night text-white' : 'bg-card'}`}>{l}</button>)}</div>
      {!data ? <Spinner /> : !data.length ? <Card className="mt-5 p-10 text-center text-ink-soft"><Inbox className="w-10 h-10 mx-auto mb-2 text-tertiary" />Nenhuma denúncia aqui.</Card>
        : <div className="mt-5 space-y-4">{data.map(r => <ReportCard key={r.id} r={r} />)}</div>}
    </div>
  )
}
