import { Card, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useLive } from '../lib/hooks'

const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const NAMES = { likes_pack: 'Curtidas extras', invites_pack: 'Convites extras', vip_month: 'ITAC VIP (30 dias)' }

export default function Sales() {
  const { data } = useLive(() => api.adminListPayments())
  if (!data) return <Spinner />
  const total = data.reduce((s, p) => s + p.amount_cents, 0)
  return (
    <div className="max-w-4xl">
      <h1 className="text-[28px] font-bold">Vendas via Pix</h1>
      <p className="text-ink-soft">{data.length} venda(s) confirmada(s) · total <b className="text-ink">{brl(total)}</b></p>
      <Card className="mt-4 overflow-x-auto">
        {!data.length ? <p className="p-6 text-ink-soft">Nenhuma venda ainda.</p> : (
          <table className="w-full text-[14px] min-w-[520px]">
            <thead><tr className="text-left text-[12px] uppercase text-ink-soft"><th className="p-3">Data</th><th>Usuário</th><th>Produto</th><th className="text-right p-3">Valor</th></tr></thead>
            <tbody>{data.map(p => <tr key={p.id} className="border-t border-surface-highest"><td className="p-3">{new Date(p.paid_at || p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{p.name}</td><td>{NAMES[p.product]}</td><td className="text-right p-3 tabular-nums font-semibold">{brl(p.amount_cents)}</td></tr>)}</tbody>
          </table>)}
      </Card>
    </div>
  )
}
