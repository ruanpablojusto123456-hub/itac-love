import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Check, Copy, Crown, Heart, Loader2, Mail, QrCode, CheckCircle2 } from 'lucide-react'
import { Button, ErrorBox, Spinner } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { useLive } from '../lib/hooks'
import { friendlyError } from '../lib/constants'

const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Store() {
  const nav = useNavigate()
  const [s, setS] = useState(null)
  const [pay, setPay] = useState(null)
  const [qr, setQr] = useState(null)
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const { data: q } = useLive(() => api.quotaStatus())
  const { data: history } = useLive(() => api.listPayments())
  useEffect(() => { api.getSettings().then(setS) }, [])

  // Confirmação automática: consulta o status até o gateway confirmar
  useEffect(() => {
    if (!pay || pay.status === 'paid') return
    const t = setInterval(async () => { const p = await api.getPayment(pay.id); if (p) setPay(p) }, 4000)
    return () => clearInterval(t)
  }, [pay])

  async function buy(product) {
    setBusy(product); setError(''); setCopied(false)
    try {
      const p = await api.createPixPayment(product); setPay(p)
      setQr(p.pix_qr_base64 ? `data:image/png;base64,${p.pix_qr_base64}` : await QRCode.toDataURL(p.pix_copy_paste, { width: 260, margin: 1 }))
    } catch (e) { setError(friendlyError(e)) } finally { setBusy('') }
  }
  if (!s) return <Spinner />
  const products = [
    ['likes_pack', `${s.likes_pack_size} curtidas extras`, 'Somam ao seu saldo e não expiram à meia-noite.', s.price_likes_pack_cents, Heart, 'text-secondary bg-secondary-fixed/60'],
    ['invites_pack', `${s.invites_pack_size} convites extras`, 'Converse sem precisar de match.', s.price_invites_pack_cents, Mail, 'text-violet bg-violet/10'],
    ['vip_month', 'ITAC VIP — 30 dias', 'Curtidas e convites ilimitados durante 30 dias.', s.price_vip_month_cents, Crown, 'text-amber bg-amber/15'],
  ]
  const paid = pay?.status === 'paid'

  return (
    <div className="max-w-xl mx-auto px-4 pt-3 pb-10 lg:pt-8">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-ink-soft font-semibold"><ArrowLeft className="w-5 h-5" />Voltar</button>
      <h1 className="text-[28px] font-bold mt-2">Loja</h1>
      {q && <p className="text-ink-soft text-[14px]">Hoje você tem: <b>{q.likes_unlimited ? 'curtidas ilimitadas' : `${q.likes_left} curtidas`}</b>{!q.likes_unlimited && q.extra_likes ? ` + ${q.extra_likes} extras` : ''} · <b>{q.invites_unlimited ? 'convites ilimitados' : `${q.invites_left} convites`}</b>{!q.invites_unlimited && q.extra_invites ? ` + ${q.extra_invites} extras` : ''}. A cota diária renova à meia-noite.</p>}

      {pay ? (
        <div className="mt-5 bg-white rounded-2xl p-5 shadow-sm text-center">
          {paid ? (<>
            <CheckCircle2 className="w-16 h-16 text-tertiary mx-auto" />
            <h2 className="text-[22px] font-bold mt-2">Pagamento confirmado!</h2>
            <p className="text-ink-soft text-[14px]">O saldo já está disponível na sua conta.</p>
            <Button variant="ocean" className="w-full mt-4" onClick={() => setPay(null)}>Voltar à loja</Button>
          </>) : (<>
            <div className="inline-flex items-center gap-2 font-bold text-primary"><QrCode className="w-5 h-5" />Pague com Pix · {brl(pay.amount_cents)}</div>
            {qr && <img src={qr} alt="QR Code Pix" className="mx-auto mt-3 w-60 h-60 rounded-xl border border-surface-highest" />}
            <p className="text-[13px] text-ink-soft mt-2">Abra o app do seu banco, escolha Pix e leia o QR Code — ou use o Pix copia e cola:</p>
            <div className="mt-2 rounded-xl bg-surface-low p-3 text-[11px] break-all select-all text-left font-mono">{pay.pix_copy_paste}</div>
            <Button variant="soft" className="w-full mt-2 !py-2.5" onClick={() => navigator.clipboard?.writeText(pay.pix_copy_paste).then(() => setCopied(true)).catch(() => {})}>{copied ? <><Check className="w-4 h-4" />Copiado</> : <><Copy className="w-4 h-4" />Copiar código Pix</>}</Button>
            <p className="mt-3 inline-flex items-center gap-2 text-[14px] text-ink-soft"><Loader2 className="w-4 h-4 animate-spin" />Aguardando pagamento — a confirmação é automática</p>
            {isDemo && <Button variant="green" className="w-full mt-3" onClick={async () => { await api.simulatePixPaid(pay.id); setPay(await api.getPayment(pay.id)) }}>Simular pagamento confirmado (demonstração)</Button>}
            <button onClick={() => setPay(null)} className="block mx-auto mt-3 text-[13px] text-ink-soft underline">Cancelar</button>
          </>)}
        </div>
      ) : (
        <ul className="mt-5 space-y-3">{products.map(([id, title, desc, price, I, tone]) => (
          <li key={id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}><I className="w-6 h-6" /></div>
            <div className="flex-1 min-w-0"><b className="block">{title}</b><span className="text-[13px] text-ink-soft">{desc}</span></div>
            <Button variant={id === 'vip_month' ? 'love' : 'ocean'} className="!px-4 !py-2.5 shrink-0" loading={busy === id} onClick={() => buy(id)}>{brl(price)}</Button>
          </li>))}</ul>
      )}
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft mt-8 mb-2">Histórico de compras</h2>
      {!history?.length ? <p className="text-[14px] text-ink-soft">Nenhuma compra ainda.</p> : (
        <ul className="bg-white rounded-2xl shadow-sm divide-y divide-surface-highest">{history.map(p => (
          <li key={p.id} className="flex justify-between px-4 py-3 text-[14px]"><span>{{ likes_pack: 'Curtidas extras', invites_pack: 'Convites extras', vip_month: 'ITAC VIP' }[p.product]}<span className="block text-[12px] text-ink-soft">{new Date(p.paid_at || p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></span><b className="tabular-nums">{brl(p.amount_cents)}</b></li>))}</ul>
      )}
    </div>
  )
}
