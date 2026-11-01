import { useState } from 'react'
import { BadgeCheck, Search } from 'lucide-react'
import { Card, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { TrustBar } from './Reports'
import { api } from '../lib/api'
import { useLive } from '../lib/hooks'

const ST = { approved: ['Aprovado', 'bg-tertiary-fixed/50 text-tertiary'], pending_review: ['Em análise', 'bg-amber/20 text-[#7a4d00]'], onboarding: ['Cadastrando', 'bg-surface-mid text-ink-soft'], needs_new_photo: ['Nova foto', 'bg-amber/20 text-[#7a4d00]'], rejected: ['Reprovado', 'bg-secondary-fixed text-secondary'], under_review: ['Em revisão', 'bg-amber/20 text-[#7a4d00]'], suspended: ['Suspenso', 'bg-secondary-fixed text-secondary'], banned: ['Banido', 'bg-secondary text-white'] }

export default function Users() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const { data } = useLive(() => api.adminListUsers(q), [q])
  async function act(u, action) {
    setBusy(u.id + action)
    try { await api.adminModerate(u.id, action, action === 'warn' ? 'Advertência da moderação.' : null, 7) } finally { setBusy('') }
  }
  return (
    <div className="max-w-5xl">
      <h1 className="text-[28px] font-bold">Usuários</h1>
      <div className="relative mt-3 max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" /><input id="user-search" className="field pl-12 bg-white" placeholder="Buscar por nome ou e-mail" value={q} onChange={e => setQ(e.target.value)} /></div>
      {!data ? <Spinner /> : (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full text-[14px] min-w-[720px]">
            <thead><tr className="text-left text-[12px] uppercase text-ink-soft"><th className="p-3">Usuário</th><th>Status</th><th>Nota de confiança</th><th>Adv.</th><th className="text-right p-3">Ações</th></tr></thead>
            <tbody>{data.map(u => (
              <tr key={u.id} className="border-t border-surface-highest">
                <td className="p-3"><div className="flex items-center gap-3"><PhotoImg path={u.photo} className="w-10 h-10 rounded-full object-cover" alt="" /><div><b className="flex items-center gap-1">{u.name || '(sem nome)'}{u.verified && <BadgeCheck className="w-4 h-4 text-tertiary" />}</b><span className="text-[12px] text-ink-soft">{u.email}</span></div></div></td>
                <td><span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${ST[u.status]?.[1]}`}>{ST[u.status]?.[0] || u.status}</span></td>
                <td><TrustBar v={u.trust_score} /></td>
                <td className="tabular-nums">{u.warnings}</td>
                <td className="p-3 text-right whitespace-nowrap space-x-1">
                  {['approved', 'under_review'].includes(u.status) && <>
                    <button disabled={!!busy} onClick={() => act(u, 'warn')} className="rounded-full border border-ink-line px-3 py-1 text-[12px] font-semibold">Advertir</button>
                    <button disabled={!!busy} onClick={() => act(u, 'suspend')} className="rounded-full border border-ink-line px-3 py-1 text-[12px] font-semibold">Suspender 7d</button></>}
                  {['suspended', 'under_review'].includes(u.status) && <button disabled={!!busy} onClick={() => act(u, 'restore')} className="rounded-full border border-tertiary text-tertiary px-3 py-1 text-[12px] font-semibold">Reativar</button>}
                  {u.status !== 'banned' && <button disabled={!!busy} onClick={() => act(u, 'ban')} className="rounded-full bg-secondary text-white px-3 py-1 text-[12px] font-semibold">Banir</button>}
                </td>
              </tr>))}</tbody>
          </table>
        </Card>)}
    </div>
  )
}
