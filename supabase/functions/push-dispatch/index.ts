// Envia push (Firebase Cloud Messaging v1) quando uma notificação é criada no banco.
// Chamada pelo trigger do banco (0007_push.sql) com o cabeçalho x-push-secret.
// Secret necessário: FCM_SERVICE_ACCOUNT (JSON da conta de serviço do Firebase).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === 'string' ? new TextEncoder().encode(buf) : new Uint8Array(buf as ArrayBuffer)
  let s = ''; bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cached: { token: string; exp: number } | null = null
async function accessToken(sa: { client_email: string; private_key: string }) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`))
  const jwt = `${header}.${claim}.${b64url(sig)}`
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })
  const j = await r.json()
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return cached.token
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: allowed } = await db.rpc('push_check', { p_secret: req.headers.get('x-push-secret') ?? '' })
  if (!allowed) return new Response('forbidden', { status: 403 })
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) return new Response(JSON.stringify({ skipped: 'FCM_SERVICE_ACCOUNT não configurado' }), { status: 200 })
  const sa = JSON.parse(raw)
  const { notification_id } = await req.json()
  const { data: n } = await db.from('notifications').select('id, user_id, type, title, body, data').eq('id', notification_id).single()
  if (!n) return new Response('not found', { status: 404 })
  const { data: p } = await db.from('profiles').select('fcm_token').eq('id', n.user_id).single()
  if (!p?.fcm_token) return new Response(JSON.stringify({ skipped: 'sem token' }))
  const data: Record<string, string> = { type: n.type }
  for (const [k, v] of Object.entries(n.data ?? {})) data[k] = String(v)
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token: p.fcm_token, notification: { title: n.title, body: n.body ?? '' }, data,
      android: { priority: 'HIGH', notification: { channel_id: 'mensagens', sound: 'default', tag: data.conversation_id } } } }),
  })
  const out = await r.json()
  if (out.error?.details?.some((d: { errorCode?: string }) => d.errorCode === 'UNREGISTERED')) await db.from('profiles').update({ fcm_token: null }).eq('id', n.user_id)
  await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', n.id)
  return new Response(JSON.stringify({ ok: r.ok }), { headers: { 'Content-Type': 'application/json' } })
})
