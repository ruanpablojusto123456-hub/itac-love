// Webhook do Mercado Pago: confirma o pagamento consultando a API e credita o saldo.
// Publique com: supabase functions deploy pix-webhook --no-verify-jwt
import { admin, json } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const body = await req.json().catch(() => ({}))
  const id = body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id')
  if (!id) return json({ ok: true })
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` } })
  const mp = await r.json()
  if (mp.status === 'approved') await admin().rpc('credit_payment', { p_provider_id: String(mp.id) })
  return json({ ok: true })
})
