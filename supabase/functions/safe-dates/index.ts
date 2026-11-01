// Encontro seguro: (1) envia o link aos contatos quando o encontro é criado;
// (2) chamada pelo pg_cron a cada minuto: dispara o check-in e avisa os contatos.
// Secrets: TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM (ex.: whatsapp:+14155238886 ou número SMS), PUBLIC_APP_URL
import { admin, cors, json } from '../_shared/admin.ts'

async function send(to: string, text: string) {
  const sid = Deno.env.get('TWILIO_SID'), token = Deno.env.get('TWILIO_TOKEN'), from = Deno.env.get('TWILIO_FROM')
  if (!sid || !token || !from) return console.log('[simulado]', to, text)
  const dest = from.startsWith('whatsapp:') ? `whatsapp:${to}` : to
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: dest, Body: text }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = admin(); const app = Deno.env.get('PUBLIC_APP_URL') ?? ''
  const body = await req.json().catch(() => ({}))
  const ids: string[] = body.action === 'share' ? [body.safe_date_id] : ((await db.rpc('job_safe_dates')).data ?? [])
  for (const id of ids) {
    const { data: d } = await db.from('safe_dates').select('*, user:profiles!safe_dates_user_id_fkey(name), partner:profiles!safe_dates_partner_id_fkey(name)').eq('id', id).single()
    if (!d) continue
    const { data: contacts } = await db.from('trusted_contacts').select('*').eq('user_id', d.user_id)
    const link = `${app}#/encontro/${d.share_token}`
    const when = new Date(d.starts_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const loc = d.last_lat ? ` Última localização: https://maps.google.com/?q=${d.last_lat},${d.last_lng}` : ''
    const text = body.action === 'share'
      ? `${d.user.name} marcou um encontro com ${d.partner?.name ?? 'uma pessoa'} em ${d.place}, ${when}. Você é contato de confiança no ITAC LOVE. Detalhes e foto: ${link}`
      : `ALERTA ITAC LOVE: ${d.user.name} ${d.status === 'help' ? 'pediu ajuda' : 'não respondeu ao check-in'} após o encontro com ${d.partner?.name ?? '—'} em ${d.place}.${loc} Detalhes: ${link}`
    for (const c of contacts ?? []) await send(c.phone, text)
  }
  return json({ ok: true, processed: ids.length })
})
