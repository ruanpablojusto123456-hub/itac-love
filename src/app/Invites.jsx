import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Mail, X, Clock, BadgeCheck } from 'lucide-react'
import { Button, ErrorBox, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { AffinityBadge } from './ProfileView'
import { api } from '../lib/api'
import { useLive } from '../lib/hooks'
import { friendlyError } from '../lib/constants'

const STATUS = { pending: ['Aguardando', 'bg-amber/20 text-[#7a4d00]'], accepted: ['Aceito', 'bg-tertiary-fixed/50 text-tertiary'], declined: ['Recusado', 'bg-surface-mid text-ink-soft'], cancelled: ['Cancelado', 'bg-surface-mid text-ink-soft'] }

export default function Invites() {
  const nav = useNavigate()
  const [tab, setTab] = useState('received')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const { data, reload } = useLive(() => api.listInvites())

  async function respond(i, accept) {
    setBusy(i.id); setError('')
    try { const conv = await api.respondInvite(i.id, accept); if (accept && conv) nav(`/app/conversas/${conv}`); else reload() }
    catch (e) { setError(friendlyError(e)) } finally { setBusy('') }
  }
  const list = data?.[tab] || []
  return (
    <div className="max-w-xl mx-auto px-4 pt-5 lg:pt-8">
      <h1 className="text-[28px] font-bold">Convites</h1>
      <p className="text-ink-soft text-[14px]">Convites abrem um chat sem precisar de match, se a outra pessoa aceitar.</p>
      <div className="grid grid-cols-2 bg-surface-mid rounded-xl p-1 mt-4">
        {[['received', 'Recebidos'], ['sent', 'Enviados']].map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`py-2.5 rounded-lg font-display font-semibold ${tab === id ? 'bg-white text-primary shadow' : 'text-ink-soft'}`}>{l}{id === 'received' && data ? ` (${data.received.filter(i => i.status === 'pending').length})` : ''}</button>)}
      </div>
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
      {!data ? <Spinner /> : !list.length ? (
        <div className="text-center py-16 text-ink-soft"><Mail className="w-10 h-10 mx-auto mb-2 text-violet" />{tab === 'received' ? 'Nenhum convite recebido ainda.' : 'Você ainda não enviou convites. Use o botão ✉ no feed.'}</div>
      ) : (
        <ul className="mt-4 space-y-3">{list.map(i => (
          <li key={i.id} className="bg-white rounded-2xl shadow-sm p-4 flex gap-4">
            <PhotoImg path={i.other.photos?.[0]} className="w-20 h-24 rounded-xl object-cover shrink-0 no-select" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap"><b className="text-[17px]">{i.other.name}, {i.other.age}</b>{i.other.verified && <BadgeCheck className="w-5 h-5 text-tertiary" />}</div>
              {i.other.affinity != null && <AffinityBadge value={i.other.affinity} className="mt-1 !shadow-none" />}
              {i.message && <p className="text-[14px] mt-2 bg-surface-low rounded-xl px-3 py-2 italic">“{i.message}”</p>}
              <div className="flex items-center gap-2 mt-2 text-[12px] text-ink-soft"><Clock className="w-3.5 h-3.5" />{new Date(i.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS[i.status][1]}`}>{STATUS[i.status][0]}</span></div>
              {tab === 'received' && i.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button variant="soft" className="!py-2 !px-4 flex-1" onClick={() => respond(i, false)} disabled={!!busy}><X className="w-4 h-4" />Recusar</Button>
                  <Button variant="green" className="!py-2 !px-4 flex-1" onClick={() => respond(i, true)} loading={busy === i.id}><Check className="w-4 h-4" />Aceitar</Button>
                </div>)}
            </div>
          </li>))}</ul>
      )}
    </div>
  )
}
