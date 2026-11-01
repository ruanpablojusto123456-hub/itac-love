import { useState } from 'react'
import { Flag, ShieldBan, X, CheckCircle2 } from 'lucide-react'
import { Button, ErrorBox } from './ui'
import { api } from '../lib/api'
import { REPORT_REASONS, friendlyError } from '../lib/constants'

// mode: 'report' | 'block'
export default function ReportBlockSheet({ mode, person, conversationId, preset, onClose, onBlocked }) {
  const [reason, setReason] = useState(preset || '')
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  if (!mode || !person) return null

  async function submit() {
    setError('')
    if (mode === 'report' && !reason) return setError('Escolha um motivo.')
    if (mode === 'report' && reason === 'outro' && !details.trim()) return setError('Descreva o que aconteceu.')
    setBusy(true)
    try {
      if (mode === 'report') await api.reportUser(person.id, reason, details, conversationId)
      if (mode === 'block' || alsoBlock) { await api.blockUser(person.id) }
      setDone(true)
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }
  const finish = () => { onClose(); if (mode === 'block' || alsoBlock) onBlocked?.() }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end sm:items-center justify-center" onClick={done ? finish : onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto animate-pop safe-bottom" onClick={e => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-14 h-14 text-tertiary mx-auto" />
            <h2 className="text-[22px] font-bold mt-3">{mode === 'report' ? 'Denúncia enviada' : `${person.name} foi bloqueado(a)`}</h2>
            <p className="text-ink-soft mt-1 text-[14px]">{mode === 'report' ? 'Nossa moderação vai analisar. Obrigado por proteger a comunidade.' : 'Essa pessoa não verá mais seu perfil e não será avisada.'}</p>
            <Button variant="ocean" className="w-full mt-5" onClick={finish}>Fechar</Button>
          </div>
        ) : (<>
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold flex items-center gap-2">{mode === 'report' ? <><Flag className="w-5 h-5 text-secondary" />Denunciar {person.name}</> : <><ShieldBan className="w-5 h-5 text-secondary" />Bloquear {person.name}?</>}</h2>
            <button onClick={onClose} aria-label="Fechar"><X className="w-6 h-6" /></button>
          </div>
          {mode === 'report' ? (<>
            <p className="text-[14px] text-ink-soft mt-1">A pessoa não fica sabendo quem denunciou.</p>
            <div className="mt-4 space-y-2">{REPORT_REASONS.map(r => (
              <label key={r.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${reason === r.id ? 'border-secondary bg-secondary-fixed/30' : 'border-ink-line/50'}`}>
                <input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-secondary w-5 h-5" /><span className="font-semibold text-[15px]">{r.label}</span>
              </label>))}</div>
            <textarea className="field mt-3" rows={3} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} placeholder={reason === 'outro' ? 'Conte o que aconteceu (obrigatório)' : 'Detalhes (opcional)'} />
            <label className="flex items-center gap-3 mt-3 text-[14px]"><input type="checkbox" checked={alsoBlock} onChange={e => setAlsoBlock(e.target.checked)} className="w-5 h-5 accent-secondary" />Também bloquear esta pessoa</label>
          </>) : (
            <ul className="mt-3 text-[14px] text-ink-soft space-y-1.5 list-disc pl-5"><li>Ela some do seu feed e não encontra mais seu perfil.</li><li>A conversa entre vocês é encerrada.</li><li>Ela <b>não</b> é avisada do bloqueio.</li></ul>
          )}
          <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
          <Button variant="love" className="w-full mt-4" onClick={submit} loading={busy}>{mode === 'report' ? 'Enviar denúncia' : 'Bloquear'}</Button>
        </>)}
      </div>
    </div>
  )
}
