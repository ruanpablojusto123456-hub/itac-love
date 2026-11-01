// Cria cobrança Pix no Mercado Pago. Secrets: MP_ACCESS_TOKEN, PUBLIC_WEBHOOK_URL (URL da função pix-webhook)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { admin, cors, json } from '../_shared/admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const auth = req.headers.get('Authorization') ?? ''
  const user = (await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } }).auth.getUser()).data.user
  if (!user) return json({ error: 'NAO_AUTENTICADO' }, 401)
  const { product } = await req.json()
  const db = admin()
  const { data: s } = await db.from('app_settings').select('*').eq('id', 1).single()
  const amount = ({ likes_pack: s.price_likes_pack_cents, invites_pack: s.price_invites_pack_cents, vip_month: s.price_vip_month_cents } as Record<string, number>)[product]
  if (!amount) return json({ error: 'PRODUTO_INVALIDO' }, 400)
  const { data: pay } = await db.from('payments').insert({ user_id: user.id, product, amount_cents: amount, provider: 'mercadopago' }).select().single()
  const label = { likes_pack: `${s.likes_pack_size} curtidas extras`, invites_pack: `${s.invites_pack_size} convites extras`, vip_month: 'Plano VIP mensal' }[product as 'vip_month']
  const r = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': pay.id },
    body: JSON.stringify({
      transaction_amount: amount / 100, description: `ITAC LOVE - ${label}`, payment_method_id: 'pix', external_reference: pay.id,
      notification_url: Deno.env.get('PUBLIC_WEBHOOK_URL'), payer: { email: user.email },
      date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString().replace('Z', '-00:00'),
    }),
  })
  const mp = await r.json()
  if (!r.ok) return json({ error: 'GATEWAY', detail: mp }, 502)
  const tx = mp.point_of_interaction?.transaction_data
  const { data: upd } = await db.from('payments').update({ provider_id: String(mp.id), pix_qr_base64: tx?.qr_code_base64, pix_copy_paste: tx?.qr_code }).eq('id', pay.id).select().single()
  return json(upd)
})
