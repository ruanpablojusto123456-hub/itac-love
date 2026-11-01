import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, Clock, HeartHandshake, Monitor, Smartphone, UserPlus, Wallet } from 'lucide-react'
import { Card, Spinner } from '../components/ui'
import { api } from '../lib/api'

const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Dashboard() {
  const [d, setD] = useState(null)
  const [recent, setRecent] = useState([])
  useEffect(() => {
    const load = () => { api.adminDashboard().then(setD); api.adminRecentReviews().then(setRecent) }
    load(); const off = api.onChange(load); return off
  }, [])
  if (!d) return <Spinner />
  const tiles = [
    ['Cadastros', d.cadastros, UserPlus, 'text-primary'],
    ['Aprovações pendentes', d.pendentes, Clock, 'text-amber', '/admin/verificacoes'],
    ['Perfis aprovados', d.aprovados, CheckCircle2, 'text-tertiary'],
    ['Denúncias abertas', d.denuncias_abertas, AlertTriangle, 'text-secondary', '/admin/denuncias'],
    ['Banimentos', d.banidos, Ban, 'text-secondary'],
    ['Encontros seguros ativos', d.encontros_ativos, HeartHandshake, 'text-violet'],
    ['Vendas via Pix', `${d.vendas_pix_qtd} · ${brl(d.vendas_pix_total_cents)}`, Wallet, 'text-tertiary', '/admin/vendas'],
  ]
  const web = d.acessos_web_30d, apk = d.acessos_android_30d, tot = web + apk || 1
  const status = { approved: ['Aprovado', 'bg-tertiary-fixed/50 text-tertiary'], rejected: ['Reprovado', 'bg-secondary-fixed text-secondary'], resubmit: ['Nova foto', 'bg-amber/20 text-[#7a4d00]'] }
  return (
    <div className="max-w-5xl">
      <h1 className="text-[28px] font-bold">Painel</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {tiles.map(([label, val, I, c, to]) => {
          const body = <Card className="p-4 h-full hover:shadow-md transition"><I className={`w-6 h-6 ${c}`} /><div className="mt-3 font-display text-[26px] font-bold leading-none">{val}</div><div className="text-[13px] text-ink-soft mt-1">{label}</div></Card>
          return to ? <Link key={label} to={to}>{body}</Link> : <div key={label}>{body}</div>
        })}
        <Card className="p-4 col-span-2 lg:col-span-1">
          <div className="text-[13px] text-ink-soft">Acessos por plataforma (30 dias)</div>
          <div className="mt-3 h-3 rounded-full bg-surface-highest overflow-hidden flex"><div className="bg-primary" style={{ width: `${(web / tot) * 100}%` }} /><div className="bg-tertiary" style={{ width: `${(apk / tot) * 100}%` }} /></div>
          <div className="mt-2 flex justify-between text-[13px] font-semibold"><span className="flex items-center gap-1"><Monitor className="w-4 h-4 text-primary" />Web {web}</span><span className="flex items-center gap-1"><Smartphone className="w-4 h-4 text-tertiary" />APK {apk}</span></div>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-display font-semibold text-[18px]">Últimas análises</h2>
        {!recent.length ? <p className="text-ink-soft text-[14px] mt-2">Nenhuma análise ainda.</p> : (
          <table className="w-full mt-3 text-[14px]">
            <thead><tr className="text-left text-ink-soft text-[12px] uppercase"><th className="py-2">Usuário</th><th>Resultado</th><th className="hidden sm:table-cell">Motivo</th><th className="text-right">Quando</th></tr></thead>
            <tbody>{recent.map(r => (
              <tr key={r.id} className="border-t border-surface-highest">
                <td className="py-2.5 font-semibold">{r.name}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${status[r.status]?.[1]}`}>{status[r.status]?.[0]}</span></td>
                <td className="hidden sm:table-cell text-ink-soft">{r.reason || '—'}</td>
                <td className="text-right text-ink-soft">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td>
              </tr>))}</tbody>
          </table>)}
      </Card>
    </div>
  )
}
